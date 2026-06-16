import { app, BrowserWindow, dialog, nativeImage, powerMonitor } from 'electron'
import { APP_METADATA } from '../src/shared/metadata'
import { createMainWindow } from './windows/mainWindow'
import { createWelcomeWindow } from './windows/welcomeWindow'
import { initDatabase, closeDatabase, getUserName } from './database/schema'
import { BridgeConnectionController } from './bridge/BridgeConnectionController'
import path from 'path'
import { createTray, destroyTray, updateTrayTooltip } from './utils/tray'
import { cleanupShortcuts } from './ipc/shortcut'
import { getDesktopBehaviorCoordinator } from './desktopBehavior/coordinator'
import {
  checkCubismCoreExists,
  showDownloadDialog,
  downloadWithProgress,
  registerCubismCoreProtocol
} from './utils/downloadCubismCore'
import { registerHistoryResourceProtocol } from './utils/historyResourceProtocol'
import { configureElectronDataPath } from './utils/appPaths'
import {
  createScopedLogger,
  initializeMainLogger,
  installMainProcessErrorHandlers,
  shutdownMainLogger
} from './utils/logger'
import { initializeAutoUpdater } from './utils/updater'
import { t } from '../src/i18n/mainProcess'
import './ipc/connection'
import './ipc/desktopBehavior'
import './ipc/window'
import { cleanupAllTempResources } from './ipc/window'
import './ipc/history'
import './ipc/storage'
import './ipc/model'
import './ipc/modelConfig'
import { registerModelConfigHandlers } from './ipc/modelConfig'
import { registerModelPreviewHandlers } from './ipc/modelPreview'
import './ipc/shortcut'
import './ipc/user'
import './ipc/log'
import './ipc/configExportImport'
import { applyPersistedLogLevel } from './ipc/log'
import './ipc/update'
import './ipc/connectionSettings'
import './ipc/connectionBehaviorSettings'
import './ipc/bridgeLifecycle'
import './ipc/locale'

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
  resolvedUserDataPath: appDataContext.resolvedUserDataPath
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
    void bridgeConnectionController.handleSystemSuspend(
      reason === 'lock-screen' ? 'lock-screen' : 'suspend'
    )
  }
}

function resumeBackgroundActivities(reason: string): void {
  if (!isBackgroundPaused) return
  isBackgroundPaused = false

  console.log(`[主进程] 恢复后台活动: ${reason}`)
  logger.info('background.resume', { reason })
  getDesktopBehaviorCoordinator().setBackgroundPaused(false)
  if (bridgeConnectionController) {
    void bridgeConnectionController.handleSystemResume().catch(err => {
      console.error('[主进程] 恢复后重连失败:', err)
      logger.error('background.resume_reconnect.failed', err, { reason })
    })
  }
}

function broadcastToAllWindows(channel: string, payload?: unknown): void {
  logger.debug('broadcast', {
    channel,
    windowCount: BrowserWindow.getAllWindows().length,
    payload
  })
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  })
}

export function initBridgeConnectionController() {
  logger.info('bridge_controller.init')
  bridgeConnectionController = new BridgeConnectionController()

  bridgeConnectionController.on('stateChanged', snapshot => {
    broadcastToAllWindows('bridgeLifecycle:stateChanged', snapshot)

    const statusLabel = (() => {
      switch (snapshot.status) {
        case 'connected':
          return t('tray.status.connected')
        case 'connecting':
          return t('tray.status.connecting')
        case 'handshaking':
          return t('tray.status.handshaking')
        case 'waiting_retry': {
          if (snapshot.nextRetryAt) {
            const seconds = Math.max(1, Math.ceil((snapshot.nextRetryAt - Date.now()) / 1000))
            return t('tray.status.retrying', { seconds, attempt: snapshot.reconnectAttempt })
          }
          return t('tray.status.waiting')
        }
        case 'suspended':
          return t('tray.status.suspended')
        case 'error':
          return t('tray.status.error')
        default:
          return t('tray.status.offline')
      }
    })()

    updateTrayTooltip(statusLabel)
  })

  bridgeConnectionController.on('perform:show', payload => {
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

  // 阶段 1: 同步迁移关键数据（history.db、配置、浏览器存储）
  // 必须在 initDatabase 前完成，避免目标已存在导致跳过
  const { migrateCriticalAppDataIfNeeded, migrateBackgroundAppDataIfNeeded } =
    await import('./utils/appDataMigration')
  const criticalMigrationResult = await migrateCriticalAppDataIfNeeded()
  logger.info('app_data_migration.critical.completed', {
    copiedCount: criticalMigrationResult.copiedEntries.length,
    errorCount: criticalMigrationResult.errors.length
  })
  if (criticalMigrationResult.copiedEntries.length > 0) {
    console.log(
      `[主进程] 已迁移 ${criticalMigrationResult.copiedEntries.length} 个关键数据条目（history.db/配置/存储）`
    )
  }
  if (criticalMigrationResult.errors.length > 0) {
    console.warn(
      `[主进程] 关键数据迁移存在 ${criticalMigrationResult.errors.length} 个问题: ${criticalMigrationResult.errors.join(' | ')}`
    )
  }

  // 阶段 2: 后台迁移非关键数据（models、logs 等大目录）
  void migrateBackgroundAppDataIfNeeded().then(
    migrationResult => {
      logger.info('app_data_migration.background.completed', {
        copiedCount: migrationResult.copiedEntries.length,
        errorCount: migrationResult.errors.length
      })
      if (migrationResult.copiedEntries.length > 0) {
        console.log(
          `[主进程] 已迁移 ${migrationResult.copiedEntries.length} 个后台数据条目（models/logs）`
        )
        // 通知主窗口后台迁移完成（models 迁移完成后可重试自动加载）
        broadcastToAllWindows('migration:backgroundCompleted', {
          copiedEntries: migrationResult.copiedEntries
        })
      }
      if (migrationResult.errors.length > 0) {
        console.warn(
          `[主进程] 后台数据迁移存在 ${migrationResult.errors.length} 个问题: ${migrationResult.errors.slice(0, 3).join(' | ')}`
        )
      }
    },
    error => {
      console.warn('[主进程] 后台数据迁移失败:', error)
      logger.warn('app_data_migration.background.failed', { error })
    }
  )

  // 初始化数据库（关键数据已同步迁移完成）
  try {
    initDatabase()
    applyPersistedLogLevel()
    logger.info('database.init.success')
  } catch (error) {
    console.error('[主进程] 数据库初始化失败:', error)
    logger.error('database.init.failed', error)
    timer.fail(error)
    dialog.showErrorBox(
      t('mainProcess.databaseInitFailed'),
      t('mainProcess.databaseInitFailedDetail', {
        error: error instanceof Error ? error.message : String(error)
      })
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

  // controller.initialize 改后台（启动自动连接已改 fire-and-forget）
  void controller.initialize().catch(error => {
    console.warn('[主进程] 连接控制器初始化失败:', error)
    logger.warn('bridge_controller.init.failed', { error })
  })

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

  // Cubism Core 检查移到窗口创建后（弹窗时窗口已可见，不阻塞首窗）
  void checkAndDownloadCubismCoreIfNeeded()

  timer.done({ firstLaunch: !userName })
}

/**
 * 检查并下载 Cubism Core（窗口创建后执行，不阻塞启动）
 */
async function checkAndDownloadCubismCoreIfNeeded() {
  if (!checkCubismCoreExists()) {
    console.log('[主进程] Live2D SDK 不存在，提示用户下载')
    logger.warn('cubism_core.missing')
    const userConfirmed = await showDownloadDialog()

    if (userConfirmed) {
      logger.info('cubism_core.download.confirmed')
      const downloadSuccess = await downloadWithProgress()
      if (!downloadSuccess) {
        console.warn('[主进程] SDK 下载失败或用户取消，继续启动（模型功能不可用）')
        logger.warn('cubism_core.download.failed_or_cancelled')
      } else {
        logger.info('cubism_core.download.success')
      }
    } else {
      console.log('[主进程] 用户跳过 SDK 下载，继续启动（模型功能不可用）')
      logger.warn('cubism_core.download.skipped')
    }
  }
}

/**
 * 应用程序就绪
 */
app.whenReady().then(() => {
  logger.info('app.ready')

  // macOS 开发模式下设置 Dock 图标（nativeImage 不支持 icns，必须用 PNG）
  if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
    const pngPath = path.join(process.cwd(), 'resources', 'icon.png')
    const dockIcon = nativeImage.createFromPath(pngPath)
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon)
    }
  }

  registerCubismCoreProtocol()
  registerHistoryResourceProtocol()
  registerModelConfigHandlers()
  registerModelPreviewHandlers()
  initialize().catch(err => {
    console.error('[主进程] 初始化失败:', err)
    logger.error('initialize.failed', err)
    dialog.showErrorBox(
      t('mainProcess.initFailed'),
      t('mainProcess.initFailedDetail', { error: err instanceof Error ? err.message : String(err) })
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
