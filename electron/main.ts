import { app, BrowserWindow, dialog, powerMonitor } from 'electron'
import { APP_METADATA } from '../src/shared/metadata'
import { createMainWindow } from './windows/mainWindow'
import { createWelcomeWindow } from './windows/welcomeWindow'
import { initDatabase, closeDatabase, getUserName } from './database/schema'
import { L2DBridgeClient } from './protocol/client'
import { createTray, destroyTray } from './utils/tray'
import { cleanupShortcuts } from './ipc/shortcut'
import { getDesktopBehaviorCoordinator } from './desktopBehavior/coordinator'
import { checkCubismCoreExists, showDownloadDialog, downloadWithProgress, registerCubismCoreProtocol } from './utils/downloadCubismCore'
import { registerHistoryResourceProtocol } from './utils/historyResourceProtocol'
import { migrateLegacyAppDataIfNeeded } from './utils/appDataMigration'
import { configureElectronDataPath } from './utils/appPaths'
import { initializeMainLogger, installMainProcessErrorHandlers, shutdownMainLogger } from './utils/logger'
import { initializeAutoUpdater } from './utils/updater'
import './ipc/connection'
import './ipc/desktopBehavior'
import './ipc/window'
import { cleanupAllTempResources } from './ipc/window'
import './ipc/history'
import './ipc/model'
import './ipc/shortcut'
import './ipc/user'
import './ipc/log'
import './ipc/update'
import './ipc/connectionSettings'

// 禁用 GPU 缓存以避免权限错误（可选）
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-program-cache')

// Windows 任务栏图标/分组需要 AppUserModelID 才能稳定生效
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_METADATA.appId)
}

// 启用硬件加速以获得更好的性能
// 注意：Windows 透明窗口在新版 Electron 中已支持硬件加速

const appDataContext = configureElectronDataPath()

// 全局 WebSocket 客户端实例
export let bridgeClient: L2DBridgeClient | null = null

initializeMainLogger()
installMainProcessErrorHandlers()
console.log(
  `[主进程] 数据目录模式=${appDataContext.mode} 原始路径=${appDataContext.originalUserDataPath} 当前路径=${appDataContext.resolvedUserDataPath}`
)

// 锁屏前的状态，用于解锁后恢复
let isBackgroundPaused = false

function pauseBackgroundActivities(reason: string): void {
  if (isBackgroundPaused) return
  isBackgroundPaused = true

  console.log(`[主进程] 暂停后台活动: ${reason}`)
  getDesktopBehaviorCoordinator().setBackgroundPaused(true)
  if (bridgeClient) bridgeClient.disconnect()
}

function resumeBackgroundActivities(reason: string): void {
  if (!isBackgroundPaused) return
  isBackgroundPaused = false

  console.log(`[主进程] 恢复后台活动: ${reason}`)
  getDesktopBehaviorCoordinator().setBackgroundPaused(false)
  if (bridgeClient) {
    const { url, token } = bridgeClient.getConnectionInfo()
    if (url) {
      bridgeClient.resetReconnect()
      bridgeClient.connect(url, token).catch((err) => {
        console.error('[主进程] 恢复后重连失败:', err)
      })
    }
  }
}

/**
 * 应用程序初始化
 */
async function initialize() {
  const migrationResult = await migrateLegacyAppDataIfNeeded()
  if (migrationResult.copiedEntries.length > 0) {
    console.log(
      `[主进程] 已复制 ${migrationResult.copiedEntries.length} 个旧数据条目到当前数据目录`
    )
  }
  if (migrationResult.errors.length > 0) {
    console.warn(
      `[主进程] 数据迁移存在 ${migrationResult.errors.length} 个问题: ${migrationResult.errors.slice(0, 5).join(' | ')}`
    )
  }

  // 初始化数据库
  try {
    initDatabase()
  } catch (error) {
    console.error('[主进程] 数据库初始化失败:', error)
    dialog.showErrorBox(
      '数据库初始化失败',
      `无法创建或打开数据库文件，应用将退出。\n\n错误详情: ${error instanceof Error ? error.message : String(error)}`
    )
    app.quit()
    return
  }

  // 数据库可用后再初始化更新器，避免启动竞态访问 user_config
  initializeAutoUpdater()

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
    // 应用启动检测已整合到 WindowWatcherManager，由 IPC 层管理
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
  registerCubismCoreProtocol()
  registerHistoryResourceProtocol()
  initialize().catch(err => {
    console.error('[主进程] 初始化失败:', err)
    dialog.showErrorBox(
      '初始化失败',
      `应用初始化过程中发生错误，将退出。\n\n${err instanceof Error ? err.message : String(err)}`
    )
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })

  // 锁屏时暂停所有后台活动
  powerMonitor.on('lock-screen', () => {
    pauseBackgroundActivities('lock-screen')
  })

  // 解锁后恢复
  powerMonitor.on('unlock-screen', () => {
    resumeBackgroundActivities('unlock-screen')
  })

  // 部分 Linux 桌面环境下 lock/unlock 事件可能不稳定，使用 suspend/resume 兜底
  powerMonitor.on('suspend', () => {
    pauseBackgroundActivities('suspend')
  })

  powerMonitor.on('resume', () => {
    resumeBackgroundActivities('resume')
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
  try {
    if (bridgeClient) {
      bridgeClient.disconnect()
    }
  } catch (err) {
    console.error('[主进程] 断开 Bridge 连接失败:', err)
  }
  cleanupShortcuts()
  destroyTray()
  cleanupAllTempResources()
  try {
    closeDatabase()
  } catch (err) {
    console.error('[主进程] 关闭数据库失败:', err)
  }
  shutdownMainLogger()
})

/**
 * 导出全局客户端实例
 */
export function getBridgeClient(): L2DBridgeClient | null {
  return bridgeClient
}
