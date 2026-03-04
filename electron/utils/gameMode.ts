import { screen } from 'electron'
import { getMainWindow, hideMainWindow, showMainWindow } from '../windows/mainWindow'
import { createRequire } from 'module'
import { getPlatformCapabilities } from './platformCapabilities'

const require = createRequire(import.meta.url)
const platformCapabilities = getPlatformCapabilities()

let isGameModeEnabled = false
let checkInterval: NodeJS.Timeout | null = null
let isHiddenByGameMode = false
let windowManager: any = null
let activeWinFn: (() => Promise<any>) | null = null
let hasLoggedUnsupportedReason = false

const MESSENGER_OVERLAY_TITLES = new Set([
  'qq',
  '腾讯qq',
  'wechat',
  'weixin',
  '微信',
  'tim',
])

const MESSENGER_PROCESS_KEYWORDS = [
  'qq.exe',
  'wechat.exe',
  'weixin.exe',
  'tim.exe',
]

const IGNORE_FULLSCREEN_TITLES = [
  '截图工具覆盖',
  'Snipping Tool',
  'Snip & Sketch',
  'Screenshot',
  'QQ Screenshot',
  'Xbox Game Bar',
  'NVIDIA GeForce Overlay',
  'GameViewer',
  'Windows 默认锁屏界面',
  '锁屏',
  'Lock Screen',
  'LockApp',
  'ScreenClippingHost',
  'screen clipping',
]

function normalizeToken(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function isLikelyMessengerScreenshotOverlay(
  title: string,
  processPath: string,
  bounds: { x: number; y: number; width: number; height: number },
  screenWidth: number,
  screenHeight: number
): boolean {
  const normalizedTitle = normalizeToken(title).replace(/\s+/g, '')
  if (!MESSENGER_OVERLAY_TITLES.has(normalizedTitle)) {
    return false
  }

  const normalizedPath = normalizeToken(processPath)
  if (
    normalizedPath &&
    !MESSENGER_PROCESS_KEYWORDS.some((keyword) => normalizedPath.includes(keyword))
  ) {
    return false
  }

  const nearOrigin = Math.abs(bounds.x) <= 2 && Math.abs(bounds.y) <= 2
  const nearScreenSize =
    Math.abs(bounds.width - screenWidth) <= 2 &&
    Math.abs(bounds.height - screenHeight) <= 2

  return nearOrigin && nearScreenSize
}

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

function shouldIgnoreTransientFullscreen(title: string): boolean {
  const lowerTitle = normalizeToken(title)
  return IGNORE_FULLSCREEN_TITLES.some((item) => {
    const normalizedItem = normalizeToken(item)
    return lowerTitle === normalizedItem || lowerTitle.includes(normalizedItem)
  })
}

/**
 * 初始化窗口管理器
 */
function initWindowManager() {
  if (platformCapabilities.platform !== 'win32') return null
  if (windowManager) return windowManager

  try {
    // 动态导入 node-window-manager（仅 Windows 使用）
    const { windowManager: wm } = require('node-window-manager')
    windowManager = wm
    return windowManager
  } catch (error) {
    console.error('[自动检测全屏] 初始化窗口管理器失败:', error)
    return null
  }
}

function hasFullscreenAppByWindowManager(): boolean {
  try {
    const mainWindow = getMainWindow()
    if (!mainWindow) return false

    const wm = initWindowManager()
    if (!wm) return false

    // 获取屏幕尺寸
    const primaryDisplay = screen.getPrimaryDisplay()
    const screenWidth = primaryDisplay.bounds.width
    const screenHeight = primaryDisplay.bounds.height

    // 获取活动窗口
    const activeWindow = wm.getActiveWindow()
    if (!activeWindow) {
      // 没有活动窗口，可能是显示桌面
      return false
    }

    // 获取窗口标题
    const title = activeWindow.getTitle()
    const processPath = String(activeWindow.path || '')

    // 排除桌面窗口（Program Manager 是 Windows 桌面）
    if (title === 'Program Manager' || title === '' || title === 'Windows Shell Experience Host') {
      return false
    }

    // 排除截图工具、系统覆盖层等瞬态全屏窗口
    if (shouldIgnoreTransientFullscreen(title)) {
      return false
    }

    // 检查是否是我们自己的窗口
    const mainWindowTitle = mainWindow.getTitle()
    if (title.includes(mainWindowTitle) || title.includes('DevTools')) {
      return false
    }

    // 获取窗口边界
    const bounds = activeWindow.getBounds()

    // 检查窗口是否全屏
    const isFullscreen =
      bounds.width >= screenWidth - 20 &&
      bounds.height >= screenHeight - 20 &&
      bounds.x <= 10 &&
      bounds.y <= 10

    if (
      isFullscreen &&
      isLikelyMessengerScreenshotOverlay(title, processPath, bounds, screenWidth, screenHeight)
    ) {
      console.log('[自动检测全屏] 忽略聊天软件截图覆盖层:', {
        title,
        processPath,
        bounds,
      })
      return false
    }

    if (isFullscreen) {
      console.log('[自动检测全屏] 检测到全屏应用:', {
        title,
        bounds,
        screen: { width: screenWidth, height: screenHeight }
      })
      return true
    }

    return false
  } catch (error) {
    console.error('[自动检测全屏] 检测失败:', error)
    return false
  }
}

async function hasFullscreenAppByActiveWindow(): Promise<boolean> {
  try {
    const mainWindow = getMainWindow()
    if (!mainWindow) return false

    const activeWindow = await safeGetActiveWin()
    if (!activeWindow?.bounds) return false

    const title = String(activeWindow.title || '').trim()
    if (!title || shouldIgnoreTransientFullscreen(title)) return false

    const mainWindowTitle = mainWindow.getTitle()
    if (title.includes(mainWindowTitle) || title.includes('DevTools')) return false

    const bounds = activeWindow.bounds as { x: number; y: number; width: number; height: number }
    const center = {
      x: Math.round(bounds.x + bounds.width / 2),
      y: Math.round(bounds.y + bounds.height / 2),
    }
    const display = screen.getDisplayNearestPoint(center)
    const displayBounds = display.bounds

    const closeToDisplayOrigin =
      Math.abs(bounds.x - displayBounds.x) <= 16 &&
      Math.abs(bounds.y - displayBounds.y) <= 16
    const closeToDisplaySize =
      Math.abs(bounds.width - displayBounds.width) <= 32 &&
      Math.abs(bounds.height - displayBounds.height) <= 32

    return closeToDisplayOrigin && closeToDisplaySize
  } catch (error) {
    console.error('[自动检测全屏] 活跃窗口检测失败:', error)
    return false
  }
}

/**
 * 检测是否有全屏应用
 */
async function hasFullscreenApp(): Promise<boolean> {
  if (!platformCapabilities.gameMode.supported) {
    if (!hasLoggedUnsupportedReason && platformCapabilities.gameMode.reason) {
      console.warn(`[自动检测全屏] 当前平台不支持: ${platformCapabilities.gameMode.reason}`)
      hasLoggedUnsupportedReason = true
    }
    return false
  }

  if (platformCapabilities.gameMode.mode === 'native-window-manager') {
    return hasFullscreenAppByWindowManager()
  }

  return hasFullscreenAppByActiveWindow()
}

/**
 * 检查游戏模式
 */
async function checkGameMode(): Promise<void> {
  if (!isGameModeEnabled) return

  const mainWindow = getMainWindow()
  if (!mainWindow) return

  const hasFullscreen = await hasFullscreenApp()

  if (hasFullscreen && !isHiddenByGameMode) {
    // 有全屏应用，隐藏主窗口
    console.log('[自动检测全屏] 检测到全屏应用，隐藏模型')
    hideMainWindow()
    isHiddenByGameMode = true
  } else if (!hasFullscreen && isHiddenByGameMode) {
    // 没有全屏应用，恢复主窗口
    console.log('[自动检测全屏] 全屏应用已退出，显示模型')
    showMainWindow()
    isHiddenByGameMode = false
  }
}

/**
 * 启用游戏模式
 */
export function enableGameMode(): void {
  if (isGameModeEnabled) return
  if (!platformCapabilities.gameMode.supported) return

  console.log('[自动检测全屏] 已启用')
  isGameModeEnabled = true

  if (platformCapabilities.gameMode.mode === 'native-window-manager') {
    initWindowManager()
  }

  // 先执行一次，避免等待下一个轮询周期
  void checkGameMode()

  // 每 2 秒检查一次
  checkInterval = setInterval(() => {
    void checkGameMode()
  }, 2000)
}

/**
 * 禁用游戏模式
 */
export function disableGameMode(): void {
  if (!isGameModeEnabled) return

  console.log('[自动检测全屏] 已禁用')
  isGameModeEnabled = false

  // 清除定时器
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }

  // 如果窗口被游戏模式隐藏，恢复显示
  if (isHiddenByGameMode) {
    showMainWindow()
    isHiddenByGameMode = false
  }
}

/**
 * 获取游戏模式状态
 */
export function isGameModeActive(): boolean {
  return isGameModeEnabled
}
