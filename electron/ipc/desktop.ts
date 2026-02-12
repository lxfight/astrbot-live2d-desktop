/**
 * 桌面感知模块 - 应用启动监听 + 活跃窗口 + 截图采集
 * 窗口信息使用 active-win（跨平台），截图使用 Electron desktopCapturer
 */

import { desktopCapturer, screen } from 'electron'
import { bridgeClient } from '../main'
import { getUserName } from '../database/schema'
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

async function safeGetActiveWin(): Promise<any | null> {
  try {
    return await getActiveWin()
  } catch {
    return null
  }
}

function normalizeToken(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function getWindowTokens(win: any): string[] {
  return [
    normalizeToken(win?.owner?.name),
    normalizeToken(win?.owner?.path),
    normalizeToken(win?.title),
    normalizeToken(win?.bundleId),
    normalizeToken(win?.platform),
  ].filter(Boolean)
}

function hasKeyword(tokens: string[], keywords: string[]): boolean {
  return keywords.some((kw) => tokens.some((token) => token.includes(kw)))
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
  const tokens = getWindowTokens(activeWin)
  if (!tokens.length) return false
  return hasKeyword(tokens, CAPTURE_BYPASS_KEYWORDS)
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

// 从进程名或窗口标题提取应用名称
function extractAppName(win: any): string {
  const ownerName = String(win?.owner?.name || '').trim()
  const ownerPath = normalizeToken(win?.owner?.path)
  const title = String(win?.title || '').trim()
  const ownerNameLc = ownerName.toLowerCase()

  if (
    ownerNameLc.includes('explorer') || ownerPath.endsWith('explorer.exe')
  ) {
    return 'Windows Explorer'
  }

  if (ownerNameLc.includes('screenclippinghost') || ownerNameLc.includes('snippingtool')) {
    return 'Snipping Tool'
  }

  return ownerName || title || ''
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
  uploadFn?: (jpegBuf: Buffer, mime: string) => Promise<string | null>,
  options: CaptureScreenshotOptions = {}
): Promise<DesktopCaptureResponsePayload> {
  const target = req.target || 'active'
  const activeWin = await safeGetActiveWin()
  const maxWidth = Math.min(req.maxWidth || 1280, 1920)
  const thumbSize = { width: maxWidth, height: Math.round(maxWidth * 0.5625) }
  const inlineThreshold = Math.max(64 * 1024, options.maxInlineBytes ?? 512 * 1024)
  const quality = req.quality || 80

  const getDesktopSource = async (): Promise<Electron.DesktopCapturerSource> => {
    const targetDisplay = getDisplayFromActiveWindow(activeWin)
    const desktopSources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: targetDisplay.size,
    })
    const desktopSource = pickDesktopSource(desktopSources, targetDisplay)
    if (!desktopSource) {
      throw new Error('无法获取桌面截图源')
    }
    return desktopSource
  }

  let src: Electron.DesktopCapturerSource

  if (target === 'desktop') {
    src = await getDesktopSource()
  } else {
    const shouldFallbackToDesktop = target === 'active' && shouldBypassActiveWindowCapture(activeWin)

    if (shouldFallbackToDesktop) {
      src = await getDesktopSource()
    } else {
      const windowSources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: thumbSize,
      })
      src = pickWindowSource(windowSources, target, req.windowId, activeWin)

      const candidateSize = src?.thumbnail?.getSize?.()
      const invalidWindowSource = !candidateSize || candidateSize.width <= 16 || candidateSize.height <= 16
      if (invalidWindowSource) {
        src = await getDesktopSource()
      }
    }
  }

  let size = src.thumbnail.getSize()
  let jpegBuf = src.thumbnail.toJPEG(quality)

  const invalidCapture = size.width <= 16 || size.height <= 16 || jpegBuf.length < 2048
  if (invalidCapture && target !== 'desktop') {
    src = await getDesktopSource()
    size = src.thumbnail.getSize()
    jpegBuf = src.thumbnail.toJPEG(quality)
  }

  if (size.width <= 16 || size.height <= 16) {
    throw new Error('截图源不可捕获，请稍后重试')
  }

  let image: string
  if (!uploadFn || jpegBuf.length <= inlineThreshold) {
    image = `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
  } else {
    const url = await uploadFn(jpegBuf, 'image/jpeg')
    image = url || `data:image/jpeg;base64,${jpegBuf.toString('base64')}`
  }

  return {
    image,
    width: size.width,
    height: size.height,
    window: {
      id: src.id,
      title: src.name,
      processName: activeWin?.owner?.name,
    },
  }
}

// ──────── 应用启动监听器 ────────

let knownAppKeys: Set<string> = new Set()
let launchFrequency: Map<string, { count: number; firstSeen: number }> = new Map()
let watchTimer: NodeJS.Timeout | null = null
let recentSwitchTimestamps: number[] = []
let lastObservedAppKey = ''
let suppressAppEventUntil = 0
let lastAppEventTs = 0

const BUILTIN_IGNORE: Set<string> = new Set([
  'Program Manager',
  'explorer.exe',
  'Explorer',
  'Windows Explorer',
  'File Explorer',
  '资源管理器',
  '文件资源管理器',
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
  'SnippingTool.exe',
  'ScreenClippingHost',
  'ScreenClippingHost.exe',
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

const BUILTIN_IGNORE_LOWER = new Set(Array.from(BUILTIN_IGNORE).map((name) => name.toLowerCase()))

const FREQ_THRESHOLD = 3
const FREQ_WINDOW_MS = 3 * 60 * 60 * 1000
const APP_SWITCH_DEBOUNCE_WINDOW_MS = 20 * 1000
const APP_SWITCH_DEBOUNCE_THRESHOLD = 4
const APP_SWITCH_SUPPRESS_MS = 15 * 1000
const APP_EVENT_MIN_INTERVAL_MS = 4 * 1000
const IGNORE_KEYWORDS = [
  '隐私',
  'privacy',
  'monitor',
  'overlay',
  'gameviewer',
  'screenshot',
  '截图',
  'snip',
  'snippingtool',
  'screenclippinghost',
  'screen clipping',
  'clipping',
  'explorer',
  'windows explorer',
  'file explorer',
  '资源管理器',
  '文件资源管理器',
]

function toAppKey(appName: string): string {
  return appName.trim().toLowerCase()
}

function seedKnownAppName(appName: string) {
  const key = toAppKey(appName)
  if (key) knownAppKeys.add(key)
}

function shouldIgnore(appName: string, win: any): boolean {
  const normalized = appName.trim()
  if (!normalized) return true
  if (normalized.length <= 2) return true

  const appKey = toAppKey(normalized)
  if (BUILTIN_IGNORE.has(normalized) || BUILTIN_IGNORE_LOWER.has(appKey)) return true

  const tokens = [appKey, ...getWindowTokens(win)]
  if (hasKeyword(tokens, IGNORE_KEYWORDS)) return true

  const now = Date.now()
  const freq = launchFrequency.get(appKey)
  if (freq) {
    if (now - freq.firstSeen > FREQ_WINDOW_MS) {
      launchFrequency.set(appKey, { count: 1, firstSeen: now })
      return false
    }
    if (freq.count >= FREQ_THRESHOLD) return true
  }
  return false
}

function recordLaunch(appName: string) {
  const appKey = toAppKey(appName)
  if (!appKey) return

  const now = Date.now()
  const freq = launchFrequency.get(appKey)
  if (freq && now - freq.firstSeen <= FREQ_WINDOW_MS) {
    freq.count++
  } else {
    launchFrequency.set(appKey, { count: 1, firstSeen: now })
  }
}

function resetAppSwitchDebounceState() {
  recentSwitchTimestamps = []
  lastObservedAppKey = ''
  suppressAppEventUntil = 0
  lastAppEventTs = 0
}

function trackAppSwitch(appKey: string, now: number) {
  if (lastObservedAppKey && lastObservedAppKey !== appKey) {
    recentSwitchTimestamps.push(now)
  }

  lastObservedAppKey = appKey

  const cutoff = now - APP_SWITCH_DEBOUNCE_WINDOW_MS
  recentSwitchTimestamps = recentSwitchTimestamps.filter((ts) => ts >= cutoff)
}

function shouldDebounceAppLaunchEvent(appKey: string, now: number): boolean {
  trackAppSwitch(appKey, now)

  if (recentSwitchTimestamps.length >= APP_SWITCH_DEBOUNCE_THRESHOLD) {
    suppressAppEventUntil = Math.max(suppressAppEventUntil, now + APP_SWITCH_SUPPRESS_MS)
    recentSwitchTimestamps = []
    return true
  }

  if (now < suppressAppEventUntil) return true
  if (lastAppEventTs > 0 && now - lastAppEventTs < APP_EVENT_MIN_INTERVAL_MS) return true

  return false
}

function markAppEventSent(now: number) {
  lastAppEventTs = now
}

function buildDesktopAppLaunchSystemPrompt(appName: string, userName: string): string {
  return [
    '[SYSTEM_EVENT:DESKTOP_APP_LAUNCH]',
    'This signal is automatically generated by the desktop client and is NOT a user-authored message.',
    `user_nickname: ${JSON.stringify(userName)}`,
    `detected_app: ${JSON.stringify(appName)}`,
    `event_time_utc: ${new Date().toISOString()}`,
    'guidance:',
    '- Treat this as contextual telemetry, not explicit user intent.',
    '- Do not claim screen details unless capture_screenshot is called.',
    '- Optional next actions: ignore, brief proactive comment, or capture_screenshot then respond.',
  ].join('\n')
}

export async function startAppLaunchWatcher() {
  if (watchTimer) {
    clearInterval(watchTimer)
    watchTimer = null
  }

  resetAppSwitchDebounceState()

  // Seed common shell windows to avoid false 'new app' events
  seedKnownAppName('explorer.exe')
  seedKnownAppName('Explorer')
  seedKnownAppName('Windows Explorer')
  seedKnownAppName('File Explorer')
  seedKnownAppName('资源管理器')
  seedKnownAppName('文件资源管理器')

  // Build baseline from current active app
  try {
    const win = await getActiveWin()
    if (win) {
      const name = extractAppName(win)
      if (name) seedKnownAppName(name)
    }
  } catch {
    // ignore
  }

  // Poll active window every 5s to detect app switches
  watchTimer = setInterval(async () => {
    if (!bridgeClient?.isConnected()) return

    try {
      const win = await getActiveWin()
      if (!win) return

      const appName = extractAppName(win)
      if (!appName) return

      const appKey = toAppKey(appName)
      if (!appKey) return

      const now = Date.now()
      if (shouldDebounceAppLaunchEvent(appKey, now)) return

      if (knownAppKeys.has(appKey)) return

      if (shouldIgnore(appName, win)) {
        knownAppKeys.add(appKey)
        return
      }

      recordLaunch(appName)
      knownAppKeys.add(appKey)

      const session = bridgeClient.getSession()
      const userName = getUserName()?.trim() || 'Desktop User'

      bridgeClient.sendMessage({
        content: [
          {
            type: 'text',
            text: buildDesktopAppLaunchSystemPrompt(appName, userName),
          },
        ],
        metadata: {
          userId: session.userId,
          userName,
          sessionId: session.sessionId,
          messageType: 'notify',
        },
      })

      markAppEventSent(now)
    } catch {
      // silent fail
    }
  }, 5000)
}

export function stopAppLaunchWatcher() {
  if (watchTimer) {
    clearInterval(watchTimer)
    watchTimer = null
  }

  resetAppSwitchDebounceState()
  knownAppKeys.clear()
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
    const req: DesktopCaptureRequestPayload = {
      target: args.target || 'active',
      quality: 80,
      maxWidth: 1920,
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
  const handler = toolHandlers[toolName]
  if (!handler) throw new Error(`未知工具: ${toolName}`)
  return await handler(args, ctx)
}
