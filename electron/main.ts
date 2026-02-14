import { app, BrowserWindow, powerMonitor } from 'electron'
import { createMainWindow } from './windows/mainWindow'
import { createWelcomeWindow } from './windows/welcomeWindow'
import { initDatabase, closeDatabase, getUserName } from './database/schema'
import { L2DBridgeClient } from './protocol/client'
import { createTray, destroyTray } from './utils/tray'
import { cleanupShortcuts } from './ipc/shortcut'
import { startAppLaunchWatcher, stopAppLaunchWatcher } from './ipc/desktop'
import { disableGameMode, enableGameMode, isGameModeActive } from './utils/gameMode'
import { hideMainWindow, showMainWindow } from './windows/mainWindow'
import { checkCubismCoreExists, showDownloadDialog, downloadWithProgress } from './utils/downloadCubismCore'
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

// 锁屏前的状态，用于解锁后恢复
let gameModeBeforeLock = false
let isScreenLocked = false

/**
 * 应用程序初始化
 */
async function initialize() {
  // 初始化数据库
  initDatabase()

  // 检查 Cubism Core 是否存在
  if (!checkCubismCoreExists()) {
    console.log('[主进程] Live2D SDK 不存在，提示用户下载')
    const userConfirmed = await showDownloadDialog()

    if (userConfirmed) {
      const downloadSuccess = await downloadWithProgress()
      if (!downloadSuccess) {
        console.error('[主进程] SDK 下载失败，应用退出')
        app.quit()
        return
      }
    } else {
      console.log('[主进程] 用户取消下载，应用退出')
      app.quit()
      return
    }
  }

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
    // 启动应用启动监听
    startAppLaunchWatcher()
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

  // 锁屏时暂停所有后台活动
  powerMonitor.on('lock-screen', () => {
    console.log('[主进程] 屏幕已锁定，暂停活动')
    isScreenLocked = true
    gameModeBeforeLock = isGameModeActive()
    stopAppLaunchWatcher()
    if (gameModeBeforeLock) disableGameMode()
    hideMainWindow()
    if (bridgeClient) bridgeClient.disconnect()
  })

  // 解锁后恢复
  powerMonitor.on('unlock-screen', () => {
    console.log('[主进程] 屏幕已解锁，恢复活动')
    isScreenLocked = false
    showMainWindow()
    if (gameModeBeforeLock) enableGameMode()
    if (bridgeClient) {
      const { url, token } = bridgeClient.getConnectionInfo()
      if (url) {
        bridgeClient.resetReconnect()
        bridgeClient.connect(url, token).catch((err) => {
          console.error('[主进程] 解锁后重连失败:', err)
        })
      }
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
  stopAppLaunchWatcher()
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
