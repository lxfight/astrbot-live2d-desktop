/**
 * 桌面感知模块 - 应用启动监听 + 活跃窗口 + 截图采集
 * 窗口信息使用 active-win（跨平台），截图使用 Electron desktopCapturer
 */

import { desktopCapturer, screen } from 'electron'
import { bridgeClient } from '../main'
import type {
  DesktopWindowInfo,
  DesktopCaptureRequestPayload,
  DesktopCaptureResponsePayload,
  DesktopWindowListPayload,
  DesktopWindowActivePayload,
  DesktopToolDeclaration,
} from '../protocol/types'

// active-win 是纯 ESM 包，动态导入
let activeWinFn: (() => Promise<any>) | null = null
async function getActiveWin(): Promise<any> {
  if (!activeWinFn) {
    const mod = await import('active-win')
    activeWinFn = mod.default
  }
  return activeWinFn()
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

// 从进程名或窗口标题提取应用名称
function extractAppName(win: any): string {
  return win.owner?.name || win.title || ''
}

// ──────── 公开 API（供 client.ts 调用）────────

export async function getWindowList(): Promise<DesktopWindowListPayload> {
  const win = await getActiveWin()
  return { windows: win ? [toWindowInfo(win)] : [] }
}

export async function getActiveWindow(): Promise<DesktopWindowActivePayload> {
  const win = await getActiveWin()
  return { window: win ? toWindowInfo(win) : null }
}

/**
 * 截图 — 返回 JPEG data URL 或通过资源服务器上传后返回 URL
 * @param uploadFn 大文件上传回调，由 client.ts 注入
 */
export async function captureScreenshot(
  req: DesktopCaptureRequestPayload,
  uploadFn?: (jpegBuf: Buffer, mime: string) => Promise<string | null>
): Promise<DesktopCaptureResponsePayload> {
  const target = req.target || 'active'
  const maxWidth = Math.min(req.maxWidth || 1280, 1920)
  const thumbSize = { width: maxWidth, height: Math.round(maxWidth * 0.5625) }

  let sources: Electron.DesktopCapturerSource[]
  if (target === 'desktop') {
    const display = screen.getPrimaryDisplay()
    sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: display.workAreaSize,
    })
  } else {
    sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: thumbSize,
    })
  }

  let src = sources[0]
  if (!src) throw new Error('无法获取截图源')

  if (target === 'window' && req.windowId) {
    src = sources.find((s) => s.id === req.windowId || s.id.includes(req.windowId!)) || src
  }

  const size = src.thumbnail.getSize()
  const jpegBuf = src.thumbnail.toJPEG(req.quality || 80)

  const INLINE_THRESHOLD = 512 * 1024
  let image: string

  if (jpegBuf.length <= INLINE_THRESHOLD || !uploadFn) {
    image = `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
  } else {
    const url = await uploadFn(jpegBuf, 'image/jpeg')
    if (url) {
      image = url
    } else {
      image = `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
    }
  }

  return {
    image,
    width: size.width,
    height: size.height,
    window: { title: src.name },
  }
}

// ──────── 应用启动监听器 ────────

let knownAppNames: Set<string> = new Set()
let launchFrequency: Map<string, { count: number; firstSeen: number }> = new Map()
let watchTimer: NodeJS.Timeout | null = null

const BUILTIN_IGNORE: Set<string> = new Set([
  'Program Manager',
  'Windows Input Experience',
  'Settings',
  'Task Manager',
  'Microsoft Text Input Application',
  'Search',
  'Windows Shell Experience Host',
  'Start',
  'Action center',
  'Notification Center',
  'NVIDIA GeForce Overlay',
  'Desktop Window Manager',
  'GameViewer',
  'Snipping Tool',
  'Screenshot',
  'QQ Screenshot',
  'Snip & Sketch',
  'Windows Security',
  'Microsoft Store',
  'Calculator',
  'Photos',
  'Movies & TV',
  'Groove Music',
  'Mail',
  'Calendar',
  'Xbox Game Bar',
  'Input Indicator',
])

const FREQ_THRESHOLD = 3
const FREQ_WINDOW_MS = 3 * 60 * 60 * 1000

function shouldIgnore(appName: string): boolean {
  if (BUILTIN_IGNORE.has(appName)) return true
  if (appName.length <= 2) return true
  const lc = appName.toLowerCase()
  const ignoreKeywords = ['隐私', 'privacy', 'monitor', 'overlay', 'gameviewer', 'screenshot', '截图', 'snip']
  if (ignoreKeywords.some((kw) => lc.includes(kw))) return true
  const now = Date.now()
  const freq = launchFrequency.get(appName)
  if (freq) {
    if (now - freq.firstSeen > FREQ_WINDOW_MS) {
      launchFrequency.set(appName, { count: 1, firstSeen: now })
      return false
    }
    if (freq.count >= FREQ_THRESHOLD) return true
  }
  return false
}

function recordLaunch(appName: string) {
  const now = Date.now()
  const freq = launchFrequency.get(appName)
  if (freq && now - freq.firstSeen <= FREQ_WINDOW_MS) {
    freq.count++
  } else {
    launchFrequency.set(appName, { count: 1, firstSeen: now })
  }
}

export async function startAppLaunchWatcher() {
  // 建立基线：记录当前活跃应用
  try {
    const win = await getActiveWin()
    if (win) {
      const name = extractAppName(win)
      if (name) knownAppNames.add(name)
    }
  } catch {
    // 忽略
  }

  // 5 秒轮询活跃窗口，检测新应用切换
  watchTimer = setInterval(async () => {
    if (!bridgeClient?.isConnected()) return

    try {
      const win = await getActiveWin()
      if (!win) return

      const appName = extractAppName(win)
      if (!appName) return

      if (knownAppNames.has(appName)) return

      knownAppNames.add(appName)
      if (shouldIgnore(appName)) return
      recordLaunch(appName)

      bridgeClient.sendMessage({
        content: [
          {
            type: 'text',
            text:
              `[desktop_event] 用户刚刚打开了新应用: ${appName}\n` +
              `你可以选择：1) 忽略 2) 对此发表评论或打招呼 3) 调用 capture_screenshot 工具查看屏幕内容后再互动`,
          },
        ],
        metadata: {
          userId: bridgeClient.getSession().userId,
          sessionId: bridgeClient.getSession().sessionId,
          messageType: 'notify',
        },
      })
    } catch {
      // 静默失败
    }
  }, 5000)
}

export function stopAppLaunchWatcher() {
  if (watchTimer) {
    clearInterval(watchTimer)
    watchTimer = null
  }
  knownAppNames.clear()
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
const toolHandlers: Record<string, (args: Record<string, any>) => Promise<any>> = {
  get_active_window: async () => {
    return await getActiveWindow()
  },
  capture_screenshot: async (args) => {
    const req: DesktopCaptureRequestPayload = {
      target: args.target || 'active',
      quality: 80,
      maxWidth: 1920,
    }
    // uploadFn 在此处不可用（需要 client 上下文），由 client.ts 注入
    return await captureScreenshot(req)
  },
}

/**
 * 统一处理服务端发来的工具调用
 */
export async function handleToolCall(toolName: string, args: Record<string, any>): Promise<any> {
  const handler = toolHandlers[toolName]
  if (!handler) throw new Error(`未知工具: ${toolName}`)
  return await handler(args)
}
