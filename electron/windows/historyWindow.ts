import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveAppIconPath } from '../utils/icon'
import { isRendererDevMode, loadRendererEntry } from './rendererEntry'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let historyWindow: BrowserWindow | null = null
let pendingPage: string | null = null
let rendererReady = false
let revealFallbackTimer: NodeJS.Timeout | null = null

if (!ipcMain.listenerCount('history:getPendingPage')) {
  ipcMain.handle('history:getPendingPage', () => {
    const page = pendingPage
    pendingPage = null
    return page
  })
}

/**
 * 创建历史记录窗口
 */
export function createHistoryWindow(page?: string): BrowserWindow {
  if (historyWindow) {
    historyWindow.focus()
    if (page) {
      if (rendererReady) {
        historyWindow.webContents.send('history:navigateTo', page)
      } else {
        pendingPage = page
      }
    }
    return historyWindow
  }

  pendingPage = page || null
  historyWindow = new BrowserWindow({
    show: false,
    width: 1000,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    title: '历史记录',
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
    historyWindow.removeMenu()
    historyWindow.setMenuBarVisibility(false)
  }

  const isDev = isRendererDevMode()

  void loadRendererEntry(historyWindow, 'history')
  if (isDev) {
    historyWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // 调试：打印加载的 URL
  historyWindow.webContents.on('did-finish-load', () => {
    console.log('[历史窗口] 页面加载完成')
  })

  historyWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[历史窗口] 页面加载失败:', errorCode, errorDescription)
  })

  rendererReady = false
  revealFallbackTimer = setTimeout(() => {
    if (historyWindow && !historyWindow.isDestroyed() && !rendererReady) {
      historyWindow.show()
    }
  }, 5000)

  historyWindow.on('maximize', () => {
    historyWindow?.webContents.send('window:maximizedChanged', true)
  })

  historyWindow.on('unmaximize', () => {
    historyWindow?.webContents.send('window:maximizedChanged', false)
  })

  historyWindow.on('closed', () => {
    if (revealFallbackTimer) {
      clearTimeout(revealFallbackTimer)
      revealFallbackTimer = null
    }
    rendererReady = false
    historyWindow = null
  })

  return historyWindow
}

/**
 * 获取历史记录窗口实例
 */
export function getHistoryWindow(): BrowserWindow | null {
  return historyWindow
}

export function markHistoryWindowRendererReady(targetWindow: BrowserWindow | null): boolean {
  if (!historyWindow || !targetWindow || historyWindow !== targetWindow) {
    return false
  }

  rendererReady = true

  if (revealFallbackTimer) {
    clearTimeout(revealFallbackTimer)
    revealFallbackTimer = null
  }

  if (!historyWindow.isDestroyed() && !historyWindow.isVisible()) {
    historyWindow.show()
  }

  if (!historyWindow.isDestroyed()) {
    historyWindow.focus()
  }

  return true
}

/**
 * 显示历史记录窗口
 */
export function showHistoryWindow(page?: string): void {
  if (historyWindow) {
    if (rendererReady || historyWindow.isVisible()) {
      historyWindow.show()
      historyWindow.focus()
    }
    if (page) {
      if (rendererReady) {
        historyWindow.webContents.send('history:navigateTo', page)
      } else {
        pendingPage = page
      }
    }
  } else {
    createHistoryWindow(page)
  }
}

/**
 * 关闭历史记录窗口
 */
export function closeHistoryWindow(): void {
  if (historyWindow) {
    historyWindow.close()
    historyWindow = null
  }
}
