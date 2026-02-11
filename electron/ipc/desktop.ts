/**
 * 桌面感知模块 - 应用启动监听 + 窗口枚举 + 截图采集
 * 全部使用 Electron desktopCapturer API，不依赖外部脚本
 */

import { desktopCapturer, screen } from 'electron'
import { bridgeClient } from '../main'
import type {
  DesktopWindowInfo,
  DesktopCaptureRequestPayload,
  DesktopCaptureResponsePayload,
  DesktopWindowListPayload,
  DesktopWindowActivePayload,
} from '../protocol/types'

// ──────── 内部工具 ────────

// 获取 desktopCapturer 窗口列表（最小缩略图，仅用于枚举）
async function enumerateWindows(): Promise<DesktopWindowInfo[]> {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1, height: 1 },
    fetchWindowIcons: false,
  })
  return sources.map((s, idx) => ({
    id: s.id,
    title: s.name,
    processName: '',
    isActive: idx === 0, // desktopCapturer 按 z-order 返回，第一个是前台窗口
  }))
}

// 从窗口标题提取应用名称（取 " - " 分隔的最后一段）
function extractAppName(title: string): string {
  const parts = title.split(' - ')
  return parts[parts.length - 1].trim() || title
}

// ──────── 公开 API（供 client.ts 调用）────────

export async function getWindowList(): Promise<DesktopWindowListPayload> {
  return { windows: await enumerateWindows() }
}

export async function getActiveWindow(): Promise<DesktopWindowActivePayload> {
  const windows = await enumerateWindows()
  return { window: windows.length > 0 ? windows[0] : null }
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
  // active / desktop 直接用第一个

  const size = src.thumbnail.getSize()
  const jpegBuf = src.thumbnail.toJPEG(req.quality || 80)

  // 阈值：512KB 以下内联，超过走资源上传
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
  // 模糊匹配：包含这些关键词的窗口标题也忽略
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
  // 建立基线
  try {
    const baseline = await enumerateWindows()
    knownAppNames = new Set(baseline.map((w) => extractAppName(w.title)))
  } catch {
    knownAppNames = new Set()
  }

  watchTimer = setInterval(async () => {
    if (!bridgeClient?.isConnected()) return

    try {
      const windows = await enumerateWindows()
      const currentApps = new Map<string, string>()
      for (const w of windows) {
        const app = extractAppName(w.title)
        if (!currentApps.has(app)) {
          currentApps.set(app, w.title)
        }
      }

      const newApps: Array<{ appName: string; title: string }> = []
      for (const [app, title] of currentApps) {
        if (knownAppNames.has(app)) continue
        knownAppNames.add(app)
        if (shouldIgnore(app)) continue
        recordLaunch(app)
        newApps.push({ appName: app, title })
      }

      // 清理已关闭的应用
      for (const app of knownAppNames) {
        if (!currentApps.has(app)) knownAppNames.delete(app)
      }

      if (newApps.length === 0) return

      const appList = newApps.map((a) => a.appName).join('、')
      bridgeClient.sendMessage({
        content: [
          {
            type: 'text',
            text:
              `[desktop_event] 用户刚刚打开了新应用: ${appList}\n` +
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
  }, 30000)
}

export function stopAppLaunchWatcher() {
  if (watchTimer) {
    clearInterval(watchTimer)
    watchTimer = null
  }
}
