import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import fs from 'node:fs'
import path from 'node:path'
import { writeLogEntry } from './logger'

type UpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  message: string
  currentVersion: string
  latestVersion?: string
  progress?: number
  releaseDate?: string
}

interface UpdateCheckResult {
  success: boolean
  message: string
  state: UpdateState
}

let initialized = false
let checkInProgress = false

let updateState: UpdateState = {
  status: 'idle',
  message: '未检查更新',
  currentVersion: app.getVersion()
}

function isPortableBuild(): boolean {
  return process.platform === 'win32' && Boolean(process.env.PORTABLE_EXECUTABLE_FILE)
}

function isAutoUpdateSupportedPlatform(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin'
}

function isAutoUpdateEnabled(): boolean {
  return app.isPackaged && isAutoUpdateSupportedPlatform() && !isPortableBuild() && hasUpdateConfigFile()
}

function hasUpdateConfigFile(): boolean {
  const configPath = path.join(process.resourcesPath, 'app-update.yml')
  return fs.existsSync(configPath)
}

function emitUpdateState(): void {
  for (const windowInstance of BrowserWindow.getAllWindows()) {
    windowInstance.webContents.send('update:stateChanged', updateState)
  }
}

function setUpdateState(patch: Partial<UpdateState>): void {
  updateState = {
    ...updateState,
    ...patch,
    currentVersion: app.getVersion()
  }

  emitUpdateState()
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function handleUpdateAvailable(info: UpdateInfo): void {
  setUpdateState({
    status: autoUpdater.autoDownload ? 'downloading' : 'available',
    message: `发现新版本 ${info.version}，${autoUpdater.autoDownload ? '正在下载更新' : '可手动下载'}`,
    latestVersion: info.version,
    releaseDate: info.releaseDate
  })
}

function handleDownloadProgress(progress: ProgressInfo): void {
  setUpdateState({
    status: 'downloading',
    message: `正在下载更新：${Math.round(progress.percent)}%`,
    progress: progress.percent
  })
}

async function promptInstallUpdate(info: UpdateInfo): Promise<void> {
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
    const result = await dialog.showMessageBox(focusedWindow, {
      type: 'info',
      title: '发现新版本',
      message: `新版本 ${info.version} 已下载完成`,
      detail: '是否现在重启并安装更新？',
      buttons: ['立即安装', '稍后'],
      defaultId: 0,
      cancelId: 1
    })

    if (result.response === 0) {
      writeLogEntry('info', 'updater', '用户确认立即安装更新')
      autoUpdater.quitAndInstall()
    }
  } catch (error) {
    writeLogEntry('error', 'updater', '弹出更新安装确认框失败:', error)
  }
}

function setupAutoUpdaterListeners(): void {
  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      message: '正在检查更新...',
      progress: undefined
    })
    writeLogEntry('info', 'updater', '开始检查更新')
  })

  autoUpdater.on('update-available', (info) => {
    handleUpdateAvailable(info)
    writeLogEntry('info', 'updater', `发现新版本: ${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      status: 'not-available',
      message: '当前已是最新版本',
      latestVersion: undefined,
      progress: undefined,
      releaseDate: undefined
    })
    writeLogEntry('info', 'updater', '当前已是最新版本')
  })

  autoUpdater.on('download-progress', (progress) => {
    handleDownloadProgress(progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({
      status: 'downloaded',
      message: `新版本 ${info.version} 已下载完成，等待安装`,
      latestVersion: info.version,
      progress: 100,
      releaseDate: info.releaseDate
    })
    writeLogEntry('info', 'updater', `更新下载完成: ${info.version}`)
    void promptInstallUpdate(info)
  })

  autoUpdater.on('error', (error) => {
    const message = extractErrorMessage(error)
    setUpdateState({
      status: 'error',
      message: `自动更新异常: ${message}`,
      progress: undefined
    })
    writeLogEntry('error', 'updater', '自动更新异常:', message)
  })
}

function getDisabledReason(): string {
  if (!app.isPackaged) {
    return '开发环境不启用自动更新'
  }

  if (isPortableBuild()) {
    return '便携版不支持自动更新'
  }

  if (!isAutoUpdateSupportedPlatform()) {
    return '当前平台暂不支持自动更新'
  }

  if (!hasUpdateConfigFile()) {
    return '缺少自动更新配置文件（app-update.yml）'
  }

  return '自动更新不可用'
}

export function getUpdateState(): UpdateState {
  return { ...updateState }
}

export function initializeAutoUpdater(): void {
  if (initialized) {
    return
  }

  initialized = true

  if (!isAutoUpdateEnabled()) {
    setUpdateState({
      status: 'disabled',
      message: getDisabledReason(),
      progress: undefined
    })
    writeLogEntry('info', 'updater', updateState.message)
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = app.getVersion().includes('-')
  autoUpdater.allowDowngrade = false

  setupAutoUpdaterListeners()

  setUpdateState({
    status: 'idle',
    message: '自动更新已启用'
  })

  writeLogEntry(
    'info',
    'updater',
    `自动更新已启用，平台=${process.platform}，当前版本=${app.getVersion()}，allowPrerelease=${autoUpdater.allowPrerelease}`
  )

  // 稍后自动检查，避免影响窗口初始化速度。
  setTimeout(() => {
    void checkForAppUpdates(false)
  }, 8000)
}

export async function checkForAppUpdates(manual = true): Promise<UpdateCheckResult> {
  if (!isAutoUpdateEnabled()) {
    setUpdateState({
      status: 'disabled',
      message: getDisabledReason(),
      progress: undefined
    })
    return {
      success: false,
      message: updateState.message,
      state: getUpdateState()
    }
  }

  if (checkInProgress) {
    return {
      success: true,
      message: '正在检查更新，请稍候',
      state: getUpdateState()
    }
  }

  checkInProgress = true

  try {
    if (manual) {
      setUpdateState({
        status: 'checking',
        message: '正在手动检查更新...',
        progress: undefined
      })
    }

    await autoUpdater.checkForUpdates()

    return {
      success: true,
      message: '已发起更新检查',
      state: getUpdateState()
    }
  } catch (error) {
    const message = extractErrorMessage(error)
    setUpdateState({
      status: 'error',
      message: `检查更新失败: ${message}`,
      progress: undefined
    })
    writeLogEntry('error', 'updater', '检查更新失败:', message)

    return {
      success: false,
      message: updateState.message,
      state: getUpdateState()
    }
  } finally {
    checkInProgress = false
  }
}

export function quitAndInstallUpdate(): { success: boolean; message: string } {
  if (updateState.status !== 'downloaded') {
    return {
      success: false,
      message: '当前没有可安装的已下载更新'
    }
  }

  writeLogEntry('info', 'updater', '收到手动安装更新请求，准备重启安装')
  autoUpdater.quitAndInstall()

  return {
    success: true,
    message: '正在重启并安装更新'
  }
}
