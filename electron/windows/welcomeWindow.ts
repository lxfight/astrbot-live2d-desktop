import { BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

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
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // 开发环境加载 Vite 服务器
  const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged

  if (isDev) {
    welcomeWindow.loadURL('http://localhost:5173/#/welcome')
  } else {
    welcomeWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'), {
      hash: '/welcome'
    })
  }

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
