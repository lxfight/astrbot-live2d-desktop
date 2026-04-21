import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveAppIconPath } from '../utils/icon'
import { isRendererDevMode, loadRendererEntry } from './rendererEntry'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let settingsWindow: BrowserWindow | null = null
let pendingPage: string | null = null
let rendererReady = false
let revealFallbackTimer: NodeJS.Timeout | null = null

// 处理渲染进程请求待处理页面的 IPC（守卫避免重复注册）
if (!ipcMain.listenerCount('settings:getPendingPage')) {
  ipcMain.handle('settings:getPendingPage', () => {
    const page = pendingPage
    pendingPage = null
    return page
  })
}

/**
 * 创建设置窗口
 */
export function createSettingsWindow(page?: string): BrowserWindow {
  if (settingsWindow) {
    settingsWindow.focus()
    if (page) {
      if (rendererReady) {
        settingsWindow.webContents.send('settings:navigateTo', page)
      } else {
        pendingPage = page
      }
    }
    return settingsWindow
  }

  // 保存页面参数，等渲染进程准备好后使用
  pendingPage = page || null

  settingsWindow = new BrowserWindow({
    show: false,
    width: 1080,
    height: 720,
    minWidth: 900,
    minHeight: 560,
    title: '设置',
    icon: resolveAppIconPath(),
    frame: false,
    titleBarStyle: 'hidden',
    transparent: false,
    resizable: true,
    backgroundColor: '#171210',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (process.platform !== 'darwin') {
    settingsWindow.removeMenu()
    settingsWindow.setMenuBarVisibility(false)
  }

  const isDev = isRendererDevMode()

  void loadRendererEntry(settingsWindow, 'settings')
  if (isDev) {
    settingsWindow.webContents.openDevTools({ mode: 'detach' })
  }

  settingsWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[设置窗口] 页面加载失败:', errorCode, errorDescription)
  })

  rendererReady = false
  revealFallbackTimer = setTimeout(() => {
    if (settingsWindow && !settingsWindow.isDestroyed() && !rendererReady) {
      settingsWindow.show()
    }
  }, 5000)

  settingsWindow.on('maximize', () => {
    settingsWindow?.webContents.send('window:maximizedChanged', true)
  })

  settingsWindow.on('unmaximize', () => {
    settingsWindow?.webContents.send('window:maximizedChanged', false)
  })

  settingsWindow.on('closed', () => {
    if (revealFallbackTimer) {
      clearTimeout(revealFallbackTimer)
      revealFallbackTimer = null
    }
    rendererReady = false
    settingsWindow = null
  })

  return settingsWindow
}

/**
 * 获取设置窗口实例
 */
export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function markSettingsWindowRendererReady(targetWindow: BrowserWindow | null): boolean {
  if (!settingsWindow || !targetWindow || settingsWindow !== targetWindow) {
    return false
  }

  rendererReady = true

  if (revealFallbackTimer) {
    clearTimeout(revealFallbackTimer)
    revealFallbackTimer = null
  }

  if (!settingsWindow.isDestroyed() && !settingsWindow.isVisible()) {
    settingsWindow.show()
  }

  if (!settingsWindow.isDestroyed()) {
    settingsWindow.focus()
  }

  return true
}

/**
 * 显示设置窗口
 */
export function showSettingsWindow(page?: string): void {
  if (settingsWindow) {
    if (rendererReady || settingsWindow.isVisible()) {
      settingsWindow.show()
      settingsWindow.focus()
    }
    if (page) {
      if (rendererReady) {
        settingsWindow.webContents.send('settings:navigateTo', page)
      } else {
        pendingPage = page
      }
    }
  } else {
    createSettingsWindow(page)
  }
}

/**
 * 关闭设置窗口
 */
export function closeSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.close()
    settingsWindow = null
  }
}
