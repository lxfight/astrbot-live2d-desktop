/**
 * 桌面感知模块 - 活跃窗口 + 截图采集
 * 窗口信息使用 active-win（跨平台），截图使用 Electron desktopCapturer
 */

import { BrowserWindow, desktopCapturer, screen } from 'electron'
import { loadScreenshotSettings } from '../utils/screenshotSettings'
import {
  safeGetActiveWindow as safeLoadActiveWindow,
} from '../utils/activeWinLoader'
import { createScopedLogger } from '../utils/logger'
import type {
  DesktopWindowInfo,
  DesktopCaptureRequestPayload,
  DesktopCaptureResponsePayload,
  DesktopWindowListPayload,
  DesktopWindowActivePayload,
  DesktopToolDeclaration,
} from '../protocol/types'

const logger = createScopedLogger('desktop.capture')

async function safeGetActiveWin(): Promise<any | null> {
  return await safeLoadActiveWindow()
}

function normalizeToken(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function isOwnWindow(win: any): boolean {
  if (!win) return false

  const ownerPath = normalizeToken(win?.owner?.path)
  const ownerName = normalizeToken(win?.owner?.name)
  const title = String(win?.title || '').trim()
  const currentExecPath = normalizeToken(process.execPath)

  if (ownerPath && currentExecPath && ownerPath === currentExecPath) {
    return true
  }

  if (ownerName === 'electron' || ownerName === 'astrbot live2d desktop') {
    return true
  }

  if (!title) return false

  for (const browserWindow of BrowserWindow.getAllWindows()) {
    if (browserWindow.isDestroyed()) continue
    const windowTitle = String(browserWindow.getTitle() || '').trim()
    if (windowTitle && (title === windowTitle || title.includes(windowTitle))) {
      return true
    }
  }

  if (title.includes('AstrBot Live2D') || title.includes('DevTools')) {
    return true
  }

  return false
}

const CAPTURE_BYPASS_KEYWORDS = [
  'astrbot',
  'live2d',
  'overlay',
  'screenshot',
  'snipping tool',
  'snip & sketch',
  'screenclippinghost',
  'clipping',
  '截图',
  '截屏',
]

function shouldBypassActiveWindowCapture(activeWin: any): boolean {
  const tokens = [
    normalizeToken(activeWin?.owner?.name),
    normalizeToken(activeWin?.owner?.path),
    normalizeToken(activeWin?.title),
  ].filter(Boolean)
  if (!tokens.length) return false
  return CAPTURE_BYPASS_KEYWORDS.some((kw) =>
    tokens.some((token) => token.includes(kw))
  )
}

function getDisplayFromActiveWindow(win: any): Electron.Display {
  if (win?.bounds) {
    const center = {
      x: Math.round(win.bounds.x + win.bounds.width / 2),
      y: Math.round(win.bounds.y + win.bounds.height / 2),
    }
    return screen.getDisplayNearestPoint(center)
  }
  return screen.getPrimaryDisplay()
}

function pickDesktopSource(
  sources: Electron.DesktopCapturerSource[],
  display: Electron.Display
): Electron.DesktopCapturerSource {
  const displayId = String(display.id)
  return (
    sources.find((s) => s.display_id === displayId) ||
    sources.find((s) => !s.display_id || s.display_id === '0') ||
    sources[0]
  )
}

function pickWindowSource(
  sources: Electron.DesktopCapturerSource[],
  target: DesktopCaptureRequestPayload['target'],
  reqWindowId: string | undefined,
  activeWin: any
): Electron.DesktopCapturerSource {
  const activeId = String(activeWin?.id || '')
  const activeTitle = String(activeWin?.title || '').trim()

  return (
    (target === 'window' && reqWindowId
      ? sources.find((s) => s.id === reqWindowId || s.id.includes(reqWindowId))
      : undefined) ||
    (target === 'active' && activeId
      ? sources.find((s) => s.id === activeId || s.id.includes(activeId))
      : undefined) ||
    (target === 'active' && activeTitle
      ? sources.find((s) => s.name === activeTitle || s.name.includes(activeTitle))
      : undefined) ||
    sources[0]
  )
}

interface CaptureScreenshotOptions {
  maxInlineBytes?: number
}

export interface ToolCallContext {
  uploadFn?: (jpegBuf: Buffer, mime: string) => Promise<string | null>
  maxInlineBytes?: number
}

// ──────── 内部工具 ────────

function toWindowInfo(win: any): DesktopWindowInfo {
  return {
    id: String(win.id ?? ''),
    title: win.title ?? '',
    processName: win.owner?.name ?? '',
    isActive: true,
  }
}

// ──────── 公开 API（供 client.ts 调用）────────

export async function getWindowList(): Promise<DesktopWindowListPayload> {
  const timer = logger.timer('window_list')
  const win = await safeGetActiveWin()
  if (!win || isOwnWindow(win)) {
    timer.done({
      count: 0,
      ignoredOwnWindow: Boolean(win && isOwnWindow(win)),
    })
    return { windows: [] }
  }
  const payload = { windows: [toWindowInfo(win)] }
  timer.done({
    count: payload.windows.length,
    title: payload.windows[0]?.title,
    processName: payload.windows[0]?.processName,
  })
  return payload
}

export async function getActiveWindow(): Promise<DesktopWindowActivePayload> {
  const timer = logger.timer('active_window')
  const win = await safeGetActiveWin()
  if (!win || isOwnWindow(win)) {
    timer.done({
      hasWindow: false,
      ignoredOwnWindow: Boolean(win && isOwnWindow(win)),
    })
    return { window: null }
  }
  const windowInfo = toWindowInfo(win)
  timer.done({
    hasWindow: true,
    title: windowInfo.title,
    processName: windowInfo.processName,
  })
  return { window: windowInfo }
}

/**
 * 截图 — 返回 JPEG data URL 或通过资源服务器上传后返回 URL
 * @param uploadFn 大文件上传回调，由 client.ts 注入
 */
export async function captureScreenshot(
  req: DesktopCaptureRequestPayload,
  uploadFn?: (jpegBuf: Buffer, mime: string) => Promise<string | null>,
  options: CaptureScreenshotOptions = {}
): Promise<DesktopCaptureResponsePayload> {
  const timer = logger.timer('screenshot', {
    requestedTarget: req.target,
    requestedWindowId: req.windowId,
    requestedQuality: req.quality,
    requestedMaxWidth: req.maxWidth,
    hasUploadFn: Boolean(uploadFn),
    maxInlineBytes: options.maxInlineBytes,
  })
  const screenshotSettings = loadScreenshotSettings()
  const target = req.target || screenshotSettings.defaultTarget
  const activeWin = await safeGetActiveWin()
  const maxWidth = Math.min(req.maxWidth || screenshotSettings.maxWidth, 3840)
  const thumbSize = { width: maxWidth, height: Math.round(maxWidth * 0.5625) }
  const inlineThreshold = Math.max(64 * 1024, options.maxInlineBytes ?? 512 * 1024)
  const quality = req.quality || screenshotSettings.quality

  const getDesktopSource = async (): Promise<Electron.DesktopCapturerSource> => {
    const targetDisplay = getDisplayFromActiveWindow(activeWin)
    logger.debug('desktop_source.select.start', {
      displayId: targetDisplay.id,
      displayBounds: targetDisplay.bounds,
      displaySize: targetDisplay.size,
    })
    const desktopSources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: targetDisplay.size,
    })
    const desktopSource = pickDesktopSource(desktopSources, targetDisplay)
    if (!desktopSource) {
      throw new Error('无法获取桌面截图源')
    }
    logger.debug('desktop_source.select.success', {
      displayId: targetDisplay.id,
      sourceId: desktopSource.id,
      sourceName: desktopSource.name,
      sourceCount: desktopSources.length,
    })
    return desktopSource
  }

  let src: Electron.DesktopCapturerSource
  let fallbackReason: string | null = null

  if (target === 'desktop') {
    src = await getDesktopSource()
  } else {
    const shouldFallbackToDesktop = target === 'active' && shouldBypassActiveWindowCapture(activeWin)

    if (shouldFallbackToDesktop) {
      fallbackReason = 'active_window_bypassed'
      src = await getDesktopSource()
    } else {
      const windowSources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: thumbSize,
      })
      src = pickWindowSource(windowSources, target, req.windowId, activeWin)
      logger.debug('window_source.select', {
        target,
        requestedWindowId: req.windowId,
        activeWindowId: activeWin?.id,
        activeWindowTitle: activeWin?.title,
        sourceId: src?.id,
        sourceName: src?.name,
        sourceCount: windowSources.length,
      })

      const candidateSize = src?.thumbnail?.getSize?.()
      const invalidWindowSource = !candidateSize || candidateSize.width <= 16 || candidateSize.height <= 16
      if (invalidWindowSource) {
        fallbackReason = 'invalid_window_source'
        src = await getDesktopSource()
      }
    }
  }

  let size = src.thumbnail.getSize()
  let jpegBuf = src.thumbnail.toJPEG(quality)

  const invalidCapture = size.width <= 16 || size.height <= 16 || jpegBuf.length < 2048
  if (invalidCapture && target !== 'desktop') {
    fallbackReason = 'invalid_capture'
    src = await getDesktopSource()
    size = src.thumbnail.getSize()
    jpegBuf = src.thumbnail.toJPEG(quality)
  }

  if (size.width <= 16 || size.height <= 16) {
    timer.fail(new Error('截图源不可捕获，请稍后重试'), {
      target,
      sourceId: src.id,
      sourceName: src.name,
      width: size.width,
      height: size.height,
      bytes: jpegBuf.length,
      fallbackReason,
    })
    throw new Error('截图源不可捕获，请稍后重试')
  }

  let image: string
  let imageMode: 'inline' | 'upload' | 'upload_fallback' = 'inline'
  if (!uploadFn || jpegBuf.length <= inlineThreshold) {
    image = `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
  } else {
    const url = await uploadFn(jpegBuf, 'image/jpeg')
    imageMode = url ? 'upload' : 'upload_fallback'
    image = url || `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
  }

  const result = {
    image,
    width: size.width,
    height: size.height,
    window: {
      id: src.id,
      title: src.name,
      processName: activeWin?.owner?.name,
    },
  }
  timer.done({
    target,
    sourceId: src.id,
    sourceName: src.name,
    width: size.width,
    height: size.height,
    bytes: jpegBuf.length,
    inlineThreshold,
    imageMode,
    fallbackReason,
  })
  return result
}

// ──────── 工具声明与调用分发 ────────

/**
 * 返回桌面端暴露的工具声明列表，握手时发送给服务端
 */
export function getDesktopTools(): DesktopToolDeclaration[] {
  return [
    {
      name: 'get_active_window',
      description: '获取用户当前正在使用的活跃窗口信息（标题、进程名）。当需要了解用户正在做什么时调用。',
      parameters: [],
    },
    {
      name: 'capture_screenshot',
      description: '截取用户桌面或特定窗口的屏幕截图。截图将作为图片附加到上下文供你分析。当需要查看用户屏幕内容、帮助用户解决问题、或对用户正在看的内容进行评论时调用。',
      parameters: [
        { name: 'target', type: 'string', description: '截图目标。"desktop"（全屏）、"active"（当前活跃窗口，默认）', required: false },
      ],
    },
  ]
}

// 工具名 → 处理函数映射
const toolHandlers: Record<string, (args: Record<string, any>, ctx: ToolCallContext) => Promise<any>> = {
  get_active_window: async () => {
    return await getActiveWindow()
  },
  capture_screenshot: async (args, ctx) => {
    const screenshotSettings = loadScreenshotSettings()
    const req: DesktopCaptureRequestPayload = {
      target: args.target || screenshotSettings.defaultTarget,
      quality: screenshotSettings.quality,
      maxWidth: screenshotSettings.maxWidth,
    }
    return await captureScreenshot(req, ctx.uploadFn, { maxInlineBytes: ctx.maxInlineBytes })
  },
}

/**
 * 统一处理服务端发来的工具调用
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, any>,
  ctx: ToolCallContext = {}
): Promise<any> {
  const timer = logger.timer('tool_call', {
    toolName,
    args,
    hasUploadFn: Boolean(ctx.uploadFn),
    maxInlineBytes: ctx.maxInlineBytes,
  })
  const handler = toolHandlers[toolName]
  if (!handler) {
    const error = new Error(`未知工具: ${toolName}`)
    timer.fail(error)
    throw error
  }

  try {
    const result = await handler(args, ctx)
    timer.done({ result })
    return result
  } catch (error) {
    timer.fail(error)
    throw error
  }
}
