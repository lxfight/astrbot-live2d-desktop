import { BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let settingsWindow: BrowserWindow | null = null

/**
 * 创建设置窗口
 */
export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow) {
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    transparent: false, // Settings usually opaque background is fine, but frame false allows custom header
    resizable: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/#/settings')
    settingsWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    settingsWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'), {
      hash: '/settings'
    })
  }

  // 调试：打印加载的 URL
  settingsWindow.webContents.on('did-finish-load', () => {
    console.log('[设置窗口] 页面加载完成')
  })

  settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[设置窗口] 页面加载失败:', errorCode, errorDescription)
  })

  settingsWindow.on('closed', () => {
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

/**
 * 显示设置窗口
 */
export function showSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.show()
    settingsWindow.focus()
  } else {
    createSettingsWindow()
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
