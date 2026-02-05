import { BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let historyWindow: BrowserWindow | null = null

/**
 * 创建历史记录窗口
 */
export function createHistoryWindow(): BrowserWindow {
  if (historyWindow) {
    historyWindow.focus()
    return historyWindow
  }

  historyWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
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
    historyWindow.loadURL('http://localhost:5173/#/history')
    historyWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    historyWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'), {
      hash: '/history'
    })
  }

  // 调试：打印加载的 URL
  historyWindow.webContents.on('did-finish-load', () => {
    console.log('[历史窗口] 页面加载完成')
  })

  historyWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[历史窗口] 页面加载失败:', errorCode, errorDescription)
  })

  historyWindow.on('closed', () => {
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

/**
 * 显示历史记录窗口
 */
export function showHistoryWindow(): void {
  if (historyWindow) {
    historyWindow.show()
    historyWindow.focus()
  } else {
    createHistoryWindow()
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
