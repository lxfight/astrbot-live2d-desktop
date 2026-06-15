import { BrowserWindow, app } from 'electron'
import path from 'path'
import { resolveAppIconPath } from '../utils/icon'
import { loadRendererEntry } from './rendererEntry'

let welcomeWindow: BrowserWindow | null = null

/**
 * 创建欢迎窗口
 */
export function createWelcomeWindow(): BrowserWindow {
  welcomeWindow = new BrowserWindow({
    width: 650,
    height: 750,
    center: true,
    icon: resolveAppIconPath(),
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload.js')
    }
  })

  void loadRendererEntry(welcomeWindow, 'welcome')

  welcomeWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[欢迎窗口] 页面加载失败:', errorCode, errorDescription, validatedURL)
    }
  )

  welcomeWindow.on('closed', () => {
    welcomeWindow = null
  })

  return welcomeWindow
}

/**
 * 获取欢迎窗口实例
 */
export function getWelcomeWindow(): BrowserWindow | null {
  return welcomeWindow
}

/**
 * 关闭欢迎窗口
 */
export function closeWelcomeWindow(): void {
  if (welcomeWindow) {
    welcomeWindow.close()
    welcomeWindow = null
  }
}
