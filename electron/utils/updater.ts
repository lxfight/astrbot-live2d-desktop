import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { writeLogEntry } from './logger'
import { loadUpdaterSettings, saveUpdaterSettings } from './updaterSettings'
import type { UpdaterSettings } from '../../src/utils/updaterSettings'
import { t } from '../../src/i18n/mainProcess'

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

interface InstallUpdateResult {
  success: boolean
  message: string
}

interface AutoUpdaterWithInternals {
  channel?: string | null
  installerPath?: string | null
}

let initialized = false
let checkInProgress = false

let updateState: UpdateState = {
  status: 'idle',
  message: t('updater.notChecked'),
  currentVersion: app.getVersion()
}

function isPortableBuild(): boolean {
  return process.platform === 'win32' && Boolean(process.env.PORTABLE_EXECUTABLE_FILE)
}

function getPortableExecutablePath(): string | null {
  if (!isPortableBuild()) {
    return null
  }

  const portableExecutablePath = process.env.PORTABLE_EXECUTABLE_FILE
  return portableExecutablePath ? path.resolve(portableExecutablePath) : null
}

function getPortableUpdateChannel(): string | null {
  const portableExecutablePath = getPortableExecutablePath()
  if (!portableExecutablePath) {
    return null
  }

  return `latest-portable-${process.arch}`
}

function getDownloadedUpdateExecutablePath(): string | null {
  const updater = autoUpdater as typeof autoUpdater & AutoUpdaterWithInternals
  return updater.installerPath ? path.resolve(updater.installerPath) : null
}

function getPowerShellExecutablePath(): string {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  return path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

function createPortableUpdateScript(currentExePath: string, downloadedExePath: string): string {
  const tempDir = app.getPath('temp')
  const scriptPath = path.join(tempDir, `astrbot-portable-update-${process.pid}-${Date.now()}.ps1`)
  const scriptContent = [
    'param(',
    '  [Parameter(Mandatory = $true)][string]$CurrentExe,',
    '  [Parameter(Mandatory = $true)][string]$DownloadedExe',
    ')',
    "$ErrorActionPreference = 'Stop'",
    '$BackupExe = "$CurrentExe.old"',
    '$Deadline = (Get-Date).AddMinutes(2)',
    'while ((Get-Date) -lt $Deadline) {',
    '  try {',
    "    $Handle = [System.IO.File]::Open($CurrentExe, 'Open', 'ReadWrite', 'None')",
    '    $Handle.Dispose()',
    '    break',
    '  } catch {',
    '    Start-Sleep -Milliseconds 500',
    '  }',
    '}',
    'if (-not (Test-Path -LiteralPath $DownloadedExe)) {',
    '  throw "找不到已下载的便携版更新文件"',
    '}',
    'if (Test-Path -LiteralPath $BackupExe) {',
    '  Remove-Item -LiteralPath $BackupExe -Force -ErrorAction SilentlyContinue',
    '}',
    '$NeedRestore = $false',
    'try {',
    '  if (Test-Path -LiteralPath $CurrentExe) {',
    '    Move-Item -LiteralPath $CurrentExe -Destination $BackupExe -Force',
    '    $NeedRestore = $true',
    '  }',
    '  Move-Item -LiteralPath $DownloadedExe -Destination $CurrentExe -Force',
    '  $NeedRestore = $false',
    '  if (Test-Path -LiteralPath $BackupExe) {',
    '    Remove-Item -LiteralPath $BackupExe -Force -ErrorAction SilentlyContinue',
    '  }',
    "  Start-Process -FilePath $CurrentExe -ArgumentList '--updated'",
    '} catch {',
    '  if ($NeedRestore -and (Test-Path -LiteralPath $BackupExe) -and -not (Test-Path -LiteralPath $CurrentExe)) {',
    '    Move-Item -LiteralPath $BackupExe -Destination $CurrentExe -Force',
    '  }',
    '  throw',
    '}'
  ].join('\n')

  fs.writeFileSync(scriptPath, scriptContent, 'utf8')
  writeLogEntry('info', 'updater', `已生成便携版更新替换脚本: ${scriptPath}`)
  writeLogEntry('info', 'updater', `便携版当前路径: ${currentExePath}`)
  writeLogEntry('info', 'updater', `便携版更新包路径: ${downloadedExePath}`)
  return scriptPath
}

function installPortableUpdate(): InstallUpdateResult {
  const currentExePath = getPortableExecutablePath()
  if (!currentExePath) {
    return {
      success: false,
      message: t('updater.portable.exeNotFound')
    }
  }

  const downloadedExePath = getDownloadedUpdateExecutablePath()
  if (!downloadedExePath || !fs.existsSync(downloadedExePath)) {
    return {
      success: false,
      message: t('updater.portable.downloadNotFound')
    }
  }

  if (!fs.existsSync(currentExePath)) {
    return {
      success: false,
      message: t('updater.portable.exeNotExist')
    }
  }

  if (path.resolve(currentExePath) === path.resolve(downloadedExePath)) {
    return {
      success: false,
      message: t('updater.portable.pathAbnormal')
    }
  }

  const scriptPath = createPortableUpdateScript(currentExePath, downloadedExePath)
  const powerShellPath = getPowerShellExecutablePath()

  try {
    const child = spawn(
      powerShellPath,
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-CurrentExe',
        currentExePath,
        '-DownloadedExe',
        downloadedExePath
      ],
      {
        detached: true,
        stdio: 'ignore'
      }
    )

    child.unref()
    writeLogEntry('info', 'updater', '便携版更新替换脚本已启动，准备退出当前应用')
    setImmediate(() => {
      app.quit()
    })

    return {
      success: true,
      message: t('updater.closingReplace')
    }
  } catch (error) {
    const message = extractErrorMessage(error)
    writeLogEntry('error', 'updater', '启动便携版更新替换脚本失败:', message)
    return {
      success: false,
      message: t('updater.portableReplaceFailed', { message })
    }
  }
}

function isAutoUpdateSupportedPlatform(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin'
}

function isAutoUpdateEnabled(): boolean {
  return app.isPackaged && isAutoUpdateSupportedPlatform() && hasUpdateConfigFile()
}

function isAutoUpdateCheckEnabled(): boolean {
  return loadUpdaterSettings().autoUpdateEnabled
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
    message: autoUpdater.autoDownload
      ? t('updater.newVersionFound', { version: info.version })
      : t('updater.newVersionManual', { version: info.version }),
    latestVersion: info.version,
    releaseDate: info.releaseDate
  })
}

function handleDownloadProgress(progress: ProgressInfo): void {
  setUpdateState({
    status: 'downloading',
    message: t('updater.downloading', { percent: Math.round(progress.percent) }),
    progress: progress.percent
  })
}

async function promptInstallUpdate(info: UpdateInfo): Promise<void> {
  try {
    const focusedWindow =
      BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
    const installPromptMessage = t('updater.downloadComplete', { version: info.version })
    const installPromptDetail = isPortableBuild()
      ? t('updater.dialog.installPromptPortable')
      : t('updater.dialog.installPromptRegular')
    const confirmButtonText = isPortableBuild()
      ? t('updater.dialog.installNowPortable')
      : t('updater.dialog.installNowRegular')
    const result = await dialog.showMessageBox(focusedWindow, {
      type: 'info',
      title: t('updater.dialog.newVersionTitle'),
      message: installPromptMessage,
      detail: installPromptDetail,
      buttons: [confirmButtonText, t('updater.dialog.later')],
      defaultId: 0,
      cancelId: 1
    })

    if (result.response === 0) {
      writeLogEntry('info', 'updater', '用户确认立即安装更新')
      const installResult = quitAndInstallUpdate()
      if (!installResult.success) {
        await dialog.showMessageBox(focusedWindow, {
          type: 'error',
          title: t('updater.dialog.updateFailedTitle'),
          message: installResult.message
        })
      }
    }
  } catch (error) {
    writeLogEntry('error', 'updater', '弹出更新安装确认框失败:', error)
  }
}

function setupAutoUpdaterListeners(): void {
  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      message: t('updater.checking'),
      progress: undefined
    })
    writeLogEntry('info', 'updater', '开始检查更新')
  })

  autoUpdater.on('update-available', info => {
    handleUpdateAvailable(info)
    writeLogEntry('info', 'updater', `发现新版本: ${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      status: 'not-available',
      message: t('updater.upToDate'),
      latestVersion: undefined,
      progress: undefined,
      releaseDate: undefined
    })
    writeLogEntry('info', 'updater', '当前已是最新版本')
  })

  autoUpdater.on('download-progress', progress => {
    handleDownloadProgress(progress)
  })

  autoUpdater.on('update-downloaded', info => {
    setUpdateState({
      status: 'downloaded',
      message: isPortableBuild()
        ? t('updater.downloadedWaitReplace', { version: info.version })
        : t('updater.downloadedWaitInstall', { version: info.version }),
      latestVersion: info.version,
      progress: 100,
      releaseDate: info.releaseDate
    })
    writeLogEntry('info', 'updater', `更新下载完成: ${info.version}`)
    void promptInstallUpdate(info)
  })

  autoUpdater.on('error', error => {
    const message = extractErrorMessage(error)
    setUpdateState({
      status: 'error',
      message: t('updater.error', { message }),
      progress: undefined
    })
    writeLogEntry('error', 'updater', '自动更新异常:', message)
  })
}

function getDisabledReason(): string {
  if (!app.isPackaged) {
    return t('updater.disabled.dev')
  }

  if (!isAutoUpdateSupportedPlatform()) {
    return t('updater.disabled.platform')
  }

  if (!hasUpdateConfigFile()) {
    return t('updater.disabled.noConfig')
  }

  return t('updater.disabled.generic')
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

  const updater = autoUpdater as typeof autoUpdater & AutoUpdaterWithInternals
  const portableChannel = getPortableUpdateChannel()
  if (portableChannel) {
    updater.channel = portableChannel
    writeLogEntry('info', 'updater', `便携版更新通道已切换为 ${portableChannel}`)
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = !isPortableBuild()
  autoUpdater.allowPrerelease = app.getVersion().includes('-')
  autoUpdater.allowDowngrade = false

  setupAutoUpdaterListeners()

  setUpdateState({
    status: 'idle',
    message: t('updater.autoUpdateEnabled')
  })

  writeLogEntry(
    'info',
    'updater',
    `自动更新已启用，平台=${process.platform}，当前版本=${app.getVersion()}，channel=${updater.channel || 'latest'}，allowPrerelease=${autoUpdater.allowPrerelease}`
  )

  if (!isAutoUpdateCheckEnabled()) {
    setUpdateState({
      status: 'idle',
      message: t('updater.autoCheckDisabled')
    })
    writeLogEntry('info', 'updater', '用户已关闭自动检查更新')
    return
  }

  // 稍后自动检查，避免影响窗口初始化速度。
  setTimeout(() => {
    void checkForAppUpdates(false)
  }, 8000)
}

export function getUpdaterSettings(): UpdaterSettings {
  return loadUpdaterSettings()
}

export function updateUpdaterSettings(patch: Partial<UpdaterSettings>): UpdaterSettings {
  const nextSettings = saveUpdaterSettings(patch)
  if (!nextSettings.autoUpdateEnabled && checkInProgress) {
    setUpdateState({
      status: 'idle',
      message: t('updater.autoCheckDisabled'),
      progress: undefined
    })
  }
  if (!nextSettings.autoUpdateEnabled && updateState.status !== 'downloaded') {
    setUpdateState({
      status: 'idle',
      message: t('updater.autoCheckDisabled'),
      progress: undefined
    })
  }
  return nextSettings
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
      message: t('updater.alreadyChecking'),
      state: getUpdateState()
    }
  }

  checkInProgress = true

  try {
    if (manual) {
      setUpdateState({
        status: 'checking',
        message: t('updater.manualChecking'),
        progress: undefined
      })
    }

    await autoUpdater.checkForUpdates()

    return {
      success: true,
      message: t('updater.checkInitiated'),
      state: getUpdateState()
    }
  } catch (error) {
    const message = extractErrorMessage(error)
    setUpdateState({
      status: 'error',
      message: t('updater.checkFailed', { message }),
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
      message: t('updater.noInstalledDownload')
    }
  }

  if (isPortableBuild()) {
    writeLogEntry('info', 'updater', '收到便携版更新安装请求，准备关闭应用并替换更新')
    return installPortableUpdate()
  }

  writeLogEntry('info', 'updater', '收到手动安装更新请求，准备重启安装')
  autoUpdater.quitAndInstall()

  return {
    success: true,
    message: t('updater.restartInstall')
  }
}
