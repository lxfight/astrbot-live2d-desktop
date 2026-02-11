import { screen } from 'electron'
import { getMainWindow, hideMainWindow, showMainWindow } from '../windows/mainWindow'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let isGameModeEnabled = false
let checkInterval: NodeJS.Timeout | null = null
let isHiddenByGameMode = false
let windowManager: any = null

/**
 * 初始化窗口管理器
 */
function initWindowManager() {
  if (windowManager) return windowManager

  try {
    // 动态导入 node-window-manager
    const { windowManager: wm } = require('node-window-manager')
    windowManager = wm
    return windowManager
  } catch (error) {
    console.error('[自动检测全屏] 初始化窗口管理器失败:', error)
    return null
  }
}

/**
 * 检测是否有全屏应用
 */
function hasFullscreenApp(): boolean {
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

    // 排除桌面窗口（Program Manager 是 Windows 桌面）
    if (title === 'Program Manager' || title === '' || title === 'Windows Shell Experience Host') {
      return false
    }

    // 排除截图工具、系统覆盖层等瞬态全屏窗口
    const ignoreTitles = ['截图工具覆盖', 'Snipping Tool', 'Snip & Sketch', 'Screenshot',
      'QQ Screenshot', 'Xbox Game Bar', 'NVIDIA GeForce Overlay', 'GameViewer']
    const lowerTitle = title.toLowerCase()
    if (ignoreTitles.some((t) => title === t || lowerTitle.includes(t.toLowerCase()))) {
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

    if (isFullscreen) {
      console.log('[自动检测全屏] 检测到全屏应用:', {
        title: title,
        bounds: bounds,
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

/**
 * 检查游戏模式
 */
function checkGameMode(): void {
  if (!isGameModeEnabled) return

  const mainWindow = getMainWindow()
  if (!mainWindow) return

  const hasFullscreen = hasFullscreenApp()

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

  console.log('[自动检测全屏] 已启用')
  isGameModeEnabled = true

  // 初始化窗口管理器
  initWindowManager()

  // 每 2 秒检查一次
  checkInterval = setInterval(() => {
    checkGameMode()
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
