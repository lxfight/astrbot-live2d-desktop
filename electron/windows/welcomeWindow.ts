import { BrowserWindow, app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveAppIconPath } from '../utils/icon'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let welcomeWindow: BrowserWindow | null = null

/**
 * 创建欢迎窗口
 */
export function createWelcomeWindow(): BrowserWindow {
  welcomeWindow = new BrowserWindow({
    width: 600,
    height: 400,
    center: true,
    icon: resolveAppIconPath(),
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // 开发环境加载 Vite 服务器
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    welcomeWindow.loadURL('http://localhost:5173/#/welcome')
  } else {
    // 生产环境下渲染进程文件在 app.getAppPath()/dist 中（通常位于 resources/app.asar/dist）
    welcomeWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), {
      hash: '/welcome'
    })
  }

  welcomeWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[欢迎窗口] 页面加载失败:', errorCode, errorDescription, validatedURL)
  })

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
