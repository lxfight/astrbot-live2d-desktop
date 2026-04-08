import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveAppIconPath } from '../utils/icon'
import { getDesktopBehaviorCoordinator } from '../desktopBehavior/coordinator'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

/**
 * 创建 Live2D 显示窗口
 */
export function createMainWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { x, y, width, height } = primaryDisplay.workArea

  mainWindow = new BrowserWindow({
    show: false,
    width,
    height,
    x,
    y,
    title: '',
    icon: resolveAppIconPath(),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,
    ...(process.platform === 'win32'
      ? {
          thickFrame: false,
        }
      : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  })

  const coordinator = getDesktopBehaviorCoordinator()
  coordinator.attachMainWindow(mainWindow)

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/#/main')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), {
      hash: '/main',
    })
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[主窗口] 页面加载完成')
    if (!mainWindow) return
    mainWindow.setBackgroundColor('#00000000')
    coordinator.reapplyMainWindowState({ raiseToTop: true })
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[主窗口] 页面加载失败:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.platform === 'win32') {
    mainWindow.removeMenu()
    mainWindow.setMenuBarVisibility(false)
  }

  return mainWindow
}

/**
 * 获取主窗口实例
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
