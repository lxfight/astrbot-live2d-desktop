import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveAppIconPath } from '../utils/icon'
import { getUserConfig } from '../database/schema'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

/**
 * 创建 Live2D 显示窗口
 */
export function createMainWindow(): BrowserWindow {
  // 获取主显示器尺寸
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    icon: resolveAppIconPath(),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,
    // Windows 特定配置
    ...(process.platform === 'win32' ? {
      type: 'toolbar', // 工具窗口类型，有助于透明度
    } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false // 防止后台节流
    }
  })

  // 开发环境加载 Vite 服务器
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/#/main')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 生产环境下渲染进程文件在 app.getAppPath()/dist 中（通常位于 resources/app.asar/dist）
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), {
      hash: '/main'
    })
  }

  // 窗口加载完成后设置透明
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[主窗口] 页面加载完成')
    // 确保窗口透明
    if (mainWindow) {
      mainWindow.setBackgroundColor('#00000000')

      // 启用初始鼠标穿透（forward: true 让渲染进程仍能收到 mousemove）
      mainWindow.setIgnoreMouseEvents(true, { forward: true })

      // 重新应用置顶设置（因为某些情况下初始置顶可能失效）
      try {
        const alwaysOnTopConfig = getUserConfig('tray_always_on_top')
        // 默认为 true
        const isAlwaysOnTop = alwaysOnTopConfig === null || alwaysOnTopConfig === 'true'
        mainWindow.setAlwaysOnTop(isAlwaysOnTop)
        console.log(`[主窗口] 重新应用置顶设置: ${isAlwaysOnTop}`)
      } catch (error) {
        console.error('[主窗口] 重新应用置顶设置失败:', error)
      }
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[主窗口] 页面加载失败:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 窗口获得焦点时重新应用置顶，防止被录屏遮挡
  mainWindow.on('focus', () => {
    // 使用 setTimeout 避开录屏软件可能的窗口钩子竞争
    setTimeout(() => {
      try {
        const alwaysOnTopConfig = getUserConfig('tray_always_on_top')
        const isAlwaysOnTop = alwaysOnTopConfig === null || alwaysOnTopConfig === 'true'
        if (isAlwaysOnTop) {
          setAlwaysOnTop(true)
        }
      } catch (error) {
        console.error('[主窗口] focus 时重新应用置顶失败:', error)
      }
    }, 200)
  })

  return mainWindow
}

/**
 * 获取主窗口实例
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * 显示主窗口
 */
export function showMainWindow(): void {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
}

/**
 * 隐藏主窗口
 */
export function hideMainWindow(): void {
  if (mainWindow) {
    mainWindow.hide()
  }
}

/**
 * 设置窗口置顶
 */
export function setAlwaysOnTop(flag: boolean): void {
  if (mainWindow) {
    if (flag) {
      // 强制刷新置顶状态：先取消再重新设置
      // 这有助于解决部分录屏软件或全屏应用导致的层级失效问题
      mainWindow.setAlwaysOnTop(false)
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
      // 额外调用 moveTop 确保在最前
      mainWindow.moveTop()
    } else {
      mainWindow.setAlwaysOnTop(false)
    }
  }
}

/**
 * 设置鼠标穿透
 */
export function setIgnoreMouseEvents(ignore: boolean): void {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  }
}

/**
 * 设置完全穿透模式
 */
export function setMousePassThrough(enable: boolean): void {
  if (mainWindow) {
    if (enable) {
      // 完全穿透模式：整个窗口都穿透
      mainWindow.setIgnoreMouseEvents(true, { forward: true })
      console.log('[主窗口] 已启用完全穿透模式')
    } else {
      // 非穿透模式：窗口不穿透（但可以通过 CSS pointer-events 控制局部穿透）
      mainWindow.setIgnoreMouseEvents(false)
      console.log('[主窗口] 已禁用完全穿透模式')
    }
  }
}

/**
 * 设置窗口大小
 */
export function setWindowSize(width: number, height: number): void {
  if (mainWindow) {
    mainWindow.setSize(width, height)
    mainWindow.center()
  }
}

/**
 * 重置窗口大小（全屏）
 */
export function resetWindowSize(): void {
  if (mainWindow) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    mainWindow.setSize(width, height)
    mainWindow.setPosition(0, 0)
  }
}
