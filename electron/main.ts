import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows/mainWindow'
import { createWelcomeWindow } from './windows/welcomeWindow'
import { initDatabase, closeDatabase, getUserName } from './database/schema'
import { L2DBridgeClient } from './protocol/client'
import { createTray, destroyTray } from './utils/tray'
import { cleanupShortcuts } from './ipc/shortcut'
import './ipc/connection'
import './ipc/window'
import './ipc/history'
import './ipc/model'
import './ipc/shortcut'
import './ipc/user'

// 禁用 GPU 缓存以避免权限错误（可选）
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-program-cache')

// Windows 任务栏图标/分组需要 AppUserModelID 才能稳定生效
if (process.platform === 'win32') {
  app.setAppUserModelId('com.astrbot.live2d.desktop')
}

// 启用硬件加速以获得更好的性能
// 注意：Windows 透明窗口在新版 Electron 中已支持硬件加速

// 全局 WebSocket 客户端实例
export let bridgeClient: L2DBridgeClient | null = null

/**
 * 应用程序初始化
 */
async function initialize() {
  // 初始化数据库
  initDatabase()

  // 检查是否是首次启动（没有用户名）
  const userName = getUserName()
  if (!userName) {
    // 首次启动，显示欢迎窗口
    createWelcomeWindow()
  } else {
    // 非首次启动，直接创建主窗口
    createMainWindow()
    createTray()
    initBridgeClient()
  }
}

/**
 * 初始化 Bridge 客户端
 */
export function initBridgeClient() {
  // 创建 WebSocket 客户端
  bridgeClient = new L2DBridgeClient()

  // 监听连接事件
  bridgeClient.on('connected', (payload) => {
    console.log('[主进程] 已连接到服务器:', payload)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bridge:connected', payload)
    })
  })

  bridgeClient.on('disconnected', (info) => {
    console.log('[主进程] 已断开连接:', info)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bridge:disconnected', info)
    })
  })

  bridgeClient.on('error', (error) => {
    console.error('[主进程] 连接错误:', error)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bridge:error', error)
    })
  })

  bridgeClient.on('perform:show', (payload) => {
    console.log('[主进程] 收到表演指令:', payload)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('perform:show', payload)
    })
  })

  bridgeClient.on('perform:interrupt', () => {
    console.log('[主进程] 收到中断指令')
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('perform:interrupt')
    })
  })
}

/**
 * 应用程序就绪
 */
app.whenReady().then(() => {
  initialize()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

/**
 * 所有窗口关闭
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * 应用退出前清理
 */
app.on('before-quit', () => {
  if (bridgeClient) {
    bridgeClient.disconnect()
  }
  cleanupShortcuts()
  destroyTray()
  closeDatabase()
})

/**
 * 导出全局客户端实例
 */
export function getBridgeClient(): L2DBridgeClient | null {
  return bridgeClient
}
