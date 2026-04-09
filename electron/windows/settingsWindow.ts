import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveAppIconPath } from '../utils/icon'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let settingsWindow: BrowserWindow | null = null
let pendingPage: string | null = null

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
    // 如果窗口已存在且有页面参数，发送消息让渲染进程跳转
    if (page) {
      settingsWindow.webContents.send('settings:navigateTo', page)
    }
    return settingsWindow
  }

  // 保存页面参数，等渲染进程准备好后使用
  pendingPage = page || null

  settingsWindow = new BrowserWindow({
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

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/#/settings')
    settingsWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    settingsWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), {
      hash: '/settings'
    })
  }

  settingsWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[设置窗口] 页面加载失败:', errorCode, errorDescription)
  })

  settingsWindow.on('maximize', () => {
    settingsWindow?.webContents.send('window:maximizedChanged', true)
  })

  settingsWindow.on('unmaximize', () => {
    settingsWindow?.webContents.send('window:maximizedChanged', false)
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
export function showSettingsWindow(page?: string): void {
  if (settingsWindow) {
    settingsWindow.show()
    settingsWindow.focus()
    // 如果窗口已存在且有页面参数，发送消息让渲染进程跳转
    if (page) {
      settingsWindow.webContents.send('settings:navigateTo', page)
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
