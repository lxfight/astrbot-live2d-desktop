import { app, BrowserWindow, dialog, powerMonitor } from 'electron'
import { APP_METADATA } from '../src/shared/metadata'
import { createMainWindow } from './windows/mainWindow'
import { createWelcomeWindow } from './windows/welcomeWindow'
import { initDatabase, closeDatabase, getUserName } from './database/schema'
import { BridgeConnectionController } from './bridge/BridgeConnectionController'
import { createTray, destroyTray } from './utils/tray'
import { cleanupShortcuts } from './ipc/shortcut'
import { getDesktopBehaviorCoordinator } from './desktopBehavior/coordinator'
import { checkCubismCoreExists, showDownloadDialog, downloadWithProgress, registerCubismCoreProtocol } from './utils/downloadCubismCore'
import { registerHistoryResourceProtocol } from './utils/historyResourceProtocol'
import { migrateLegacyAppDataIfNeeded } from './utils/appDataMigration'
import { configureElectronDataPath } from './utils/appPaths'
import { createScopedLogger, initializeMainLogger, installMainProcessErrorHandlers, shutdownMainLogger } from './utils/logger'
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
import './ipc/connectionBehaviorSettings'
import './ipc/bridgeLifecycle'

// 禁用 GPU 缓存以避免权限错误（可选）
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-program-cache')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// Windows 任务栏图标/分组需要 AppUserModelID 才能稳定生效
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_METADATA.appId)
}

// 启用硬件加速以获得更好的性能
// 注意：Windows 透明窗口在新版 Electron 中已支持硬件加速

const appDataContext = configureElectronDataPath()

// 全局连接控制器实例
export let bridgeConnectionController: BridgeConnectionController | null = null

initializeMainLogger()
installMainProcessErrorHandlers()
const logger = createScopedLogger('main.lifecycle')
console.log(
  `[主进程] 数据目录模式=${appDataContext.mode} 原始路径=${appDataContext.originalUserDataPath} 当前路径=${appDataContext.resolvedUserDataPath}`
)
logger.info('data_path.configured', {
  mode: appDataContext.mode,
  originalUserDataPath: appDataContext.originalUserDataPath,
  resolvedUserDataPath: appDataContext.resolvedUserDataPath,
})

// 锁屏前的状态，用于解锁后恢复
let isBackgroundPaused = false

function pauseBackgroundActivities(reason: string): void {
  if (isBackgroundPaused) return
  isBackgroundPaused = true

  console.log(`[主进程] 暂停后台活动: ${reason}`)
  logger.info('background.pause', { reason })
  getDesktopBehaviorCoordinator().setBackgroundPaused(true)
  if (bridgeConnectionController) {
    void bridgeConnectionController.handleSystemSuspend(reason === 'lock-screen' ? 'lock-screen' : 'suspend')
  }
}

function resumeBackgroundActivities(reason: string): void {
  if (!isBackgroundPaused) return
  isBackgroundPaused = false

  console.log(`[主进程] 恢复后台活动: ${reason}`)
  logger.info('background.resume', { reason })
  getDesktopBehaviorCoordinator().setBackgroundPaused(false)
  if (bridgeConnectionController) {
    void bridgeConnectionController.handleSystemResume().catch((err) => {
      console.error('[主进程] 恢复后重连失败:', err)
      logger.error('background.resume_reconnect.failed', err, { reason })
    })
  }
}

function broadcastToAllWindows(channel: string, payload?: unknown): void {
  logger.debug('broadcast', {
    channel,
    windowCount: BrowserWindow.getAllWindows().length,
    payload,
  })
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  })
}

export function initBridgeConnectionController() {
  logger.info('bridge_controller.init')
  bridgeConnectionController = new BridgeConnectionController()

  bridgeConnectionController.on('stateChanged', (snapshot) => {
    broadcastToAllWindows('bridgeLifecycle:stateChanged', snapshot)
  })

  bridgeConnectionController.on('perform:show', (payload) => {
    broadcastToAllWindows('perform:show', payload)
  })

  bridgeConnectionController.on('perform:interrupt', () => {
    console.log('[主进程] 收到中断指令')
    broadcastToAllWindows('perform:interrupt')
  })
}

/**
 * 应用程序初始化
 */
async function initialize() {
  const timer = logger.timer('initialize')
  logger.info('initialize.start')
  const migrationResult = await migrateLegacyAppDataIfNeeded()
  logger.info('app_data_migration.completed', {
    copiedCount: migrationResult.copiedEntries.length,
    errorCount: migrationResult.errors.length,
  })
  if (migrationResult.copiedEntries.length > 0) {
    console.log(
      `[主进程] 已复制 ${migrationResult.copiedEntries.length} 个旧数据条目到当前数据目录`
    )
  }
  if (migrationResult.errors.length > 0) {
    const displayedErrors = migrationResult.errors.slice(0, 5)
    const remainingErrorCount = migrationResult.errors.length - displayedErrors.length
    const truncatedSuffix = remainingErrorCount > 0
      ? ` | 另外 ${remainingErrorCount} 个问题未展开`
      : ''

    console.warn(
      `[主进程] 数据迁移存在 ${migrationResult.errors.length} 个问题: ${displayedErrors.join(' | ')}${truncatedSuffix}`
    )
  }

  // 初始化数据库
  try {
    initDatabase()
    logger.info('database.init.success')
  } catch (error) {
    console.error('[主进程] 数据库初始化失败:', error)
    logger.error('database.init.failed', error)
    timer.fail(error)
    dialog.showErrorBox(
      '数据库初始化失败',
      `无法创建或打开数据库文件，应用将退出。\n\n错误详情: ${error instanceof Error ? error.message : String(error)}`
    )
    app.quit()
    return
  }

  // 数据库可用后再初始化更新器，避免启动竞态访问 user_config
  initializeAutoUpdater()
  logger.info('auto_updater.initialized')

  initBridgeConnectionController()
  const controller = bridgeConnectionController
  if (!controller) {
    timer.fail(new Error('连接控制器初始化失败'))
    throw new Error('连接控制器初始化失败')
  }
  await controller.initialize()

  // 检查 Cubism Core 是否存在
  if (!checkCubismCoreExists()) {
    console.log('[主进程] Live2D SDK 不存在，提示用户下载')
    logger.warn('cubism_core.missing')
    const userConfirmed = await showDownloadDialog()

    if (userConfirmed) {
      logger.info('cubism_core.download.confirmed')
      const downloadSuccess = await downloadWithProgress()
      if (!downloadSuccess) {
        console.error('[主进程] SDK 下载失败，应用退出')
        const error = new Error('SDK 下载失败')
        logger.error('cubism_core.download.failed', error)
        timer.fail(error)
        app.quit()
        return
      }
      logger.info('cubism_core.download.success')
    } else {
      console.log('[主进程] 用户取消下载，应用退出')
      logger.warn('cubism_core.download.cancelled')
      timer.done({ quitReason: 'cubism_core_download_cancelled' })
      app.quit()
      return
    }
  }

  // 检查是否是首次启动（没有用户名）
  const userName = getUserName()
  if (!userName) {
    // 首次启动，显示欢迎窗口
    logger.info('startup.first_launch')
    createWelcomeWindow()
  } else {
    // 非首次启动，直接创建主窗口
    logger.info('startup.normal', { hasUserName: true })
    createMainWindow()
    createTray()
  }
  timer.done({ firstLaunch: !userName })
}

/**
 * 应用程序就绪
 */
app.whenReady().then(() => {
  logger.info('app.ready')
  registerCubismCoreProtocol()
  registerHistoryResourceProtocol()
  initialize().catch(err => {
    console.error('[主进程] 初始化失败:', err)
    logger.error('initialize.failed', err)
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
  logger.info('window_all_closed', { platform: process.platform })
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * 应用退出前清理
 */
app.on('before-quit', () => {
  logger.info('before_quit.start')
  try {
    if (bridgeConnectionController) {
      bridgeConnectionController.dispose()
    }
  } catch (err) {
    console.error('[主进程] 关闭连接控制器失败:', err)
    logger.error('bridge_controller.dispose.failed', err)
  }
  cleanupShortcuts()
  destroyTray()
  cleanupAllTempResources()
  try {
    closeDatabase()
  } catch (err) {
    console.error('[主进程] 关闭数据库失败:', err)
    logger.error('database.close.failed', err)
  }
  logger.info('before_quit.done')
  shutdownMainLogger()
})

/**
 * 导出全局连接控制器实例
 */
export function getBridgeConnectionController(): BridgeConnectionController | null {
  return bridgeConnectionController
}
