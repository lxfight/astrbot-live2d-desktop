import { ipcMain, shell, app, dialog, BrowserWindow, net } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import {
  showSettingsWindow,
  closeSettingsWindow,
  markSettingsWindowRendererReady
} from '../windows/settingsWindow'
import { closeWelcomeWindow } from '../windows/welcomeWindow'
import { getPlatformCapabilities } from '../utils/platformCapabilities'
import { loadScreenshotSettings, saveScreenshotSettings } from '../utils/screenshotSettings'
import { decodeInlineDataUrl } from '../protocol/messageContent'
import {
  HISTORY_RESOURCE_PROTOCOL_SCHEME,
  getMessageResourceByUrl
} from '../database/messageResources'
import { createScopedLogger } from '../utils/logger'
import { t } from '../../src/i18n/mainProcess'
import {
  getCurrentDesktopSceneSnapshot,
  loadDesktopSceneSettings,
  resetDesktopSceneSettings,
  saveDesktopSceneSettings
} from '../desktopScene/service'
import {
  buildPersonalitySystemPrompt,
  loadPersonalitySettings,
  resetPersonalitySettings,
  savePersonalitySettings
} from '../personality/service'

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const ALLOWED_RESOURCE_PROTOCOLS = new Set([
  'http:',
  'https:',
  'data:',
  `${HISTORY_RESOURCE_PROTOCOL_SCHEME}:`
])
const TEMP_RESOURCE_DIR = path.join(app.getPath('temp'), 'astrbot-live2d-history')
const logger = createScopedLogger('ipc.window')

/**
 * 清理临时资源目录（删除超过 1 小时的文件）
 */
async function cleanupTempResources(): Promise<void> {
  try {
    await fs.mkdir(TEMP_RESOURCE_DIR, { recursive: true })
    const entries = await fs.readdir(TEMP_RESOURCE_DIR)
    const maxAge = Date.now() - 3600_000

    for (const name of entries) {
      const filePath = path.join(TEMP_RESOURCE_DIR, name)
      try {
        const stat = await fs.stat(filePath)
        if (stat.isFile() && stat.mtimeMs < maxAge) {
          await fs.unlink(filePath)
        }
      } catch {}
    }
  } catch {}
}

/**
 * 清理全部临时资源（应用退出时调用）
 */
export async function cleanupAllTempResources(): Promise<void> {
  try {
    await fs.rm(TEMP_RESOURCE_DIR, { recursive: true, force: true })
  } catch {}
}

function toSafeExternalUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') {
    return null
  }

  const trimmedUrl = rawUrl.trim()
  if (!trimmedUrl) {
    return null
  }

  try {
    const parsed = new URL(trimmedUrl)
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function toSafeResourceSource(rawSource: unknown): string | null {
  if (typeof rawSource !== 'string') {
    return null
  }

  const trimmedSource = rawSource.trim()
  if (!trimmedSource) {
    return null
  }

  try {
    const parsed = new URL(trimmedSource)
    if (!ALLOWED_RESOURCE_PROTOCOLS.has(parsed.protocol)) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function sanitizeSuggestedFileName(rawName: unknown, fallback = 'download.bin'): string {
  if (typeof rawName !== 'string') {
    return fallback
  }

  const trimmedName = rawName.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  return trimmedName || fallback
}

function getSenderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function normalizeWindowPage(page?: string): string | undefined {
  if (typeof page !== 'string') {
    return undefined
  }

  const normalizedPage = page.trim().replace(/^\/+/, '')
  return normalizedPage || undefined
}

async function fetchResourceBuffer(source: string): Promise<Buffer> {
  if (source.startsWith(`${HISTORY_RESOURCE_PROTOCOL_SCHEME}://`)) {
    const resource = getMessageResourceByUrl(source)
    if (!resource) {
      throw new Error(t('error.localHistoryResourceMissing'))
    }

    return Buffer.from(resource.data)
  }

  const inlineResource = decodeInlineDataUrl(source)
  if (inlineResource) {
    return inlineResource.buffer
  }

  const response = await net.fetch(source)
  if (!response.ok) {
    throw new Error(t('error.resourceRequestFailed', { status: response.status }))
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function writeResourceToPath(source: string, targetPath: string): Promise<void> {
  const buffer = await fetchResourceBuffer(source)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, buffer)
}

/**
 * 打开设置窗口
 */
ipcMain.handle('window:openSettings', async (_event, page?: string) => {
  const normalizedPage = normalizeWindowPage(page)
  logger.info('open_settings', { page: normalizedPage })
  showSettingsWindow(normalizedPage)
  return { success: true }
})

/**
 * 关闭设置窗口
 */
ipcMain.handle('window:closeSettings', async () => {
  logger.info('close_settings')
  closeSettingsWindow()
  return { success: true }
})

ipcMain.handle('window:minimizeCurrent', async event => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    logger.warn('minimize_current.failed', { reason: 'window_not_found' })
    return { success: false, error: t('error.windowNotFound') }
  }

  logger.info('minimize_current', { windowId: targetWindow.id })
  targetWindow.minimize()
  return { success: true }
})

ipcMain.handle('window:toggleMaximizeCurrent', async event => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    logger.warn('toggle_maximize_current.failed', { reason: 'window_not_found' })
    return { success: false, error: t('error.windowNotFound') }
  }

  const wasMaximized = targetWindow.isMaximized()
  if (targetWindow.isMaximized()) {
    targetWindow.unmaximize()
  } else {
    targetWindow.maximize()
  }

  logger.info('toggle_maximize_current', {
    windowId: targetWindow.id,
    wasMaximized,
    maximized: targetWindow.isMaximized()
  })
  return { success: true, maximized: targetWindow.isMaximized() }
})

ipcMain.handle('window:isMaximizedCurrent', async event => {
  const targetWindow = getSenderWindow(event)
  const maximized = targetWindow ? targetWindow.isMaximized() : false
  logger.debug('is_maximized_current', { windowId: targetWindow?.id, maximized })
  return maximized
})

ipcMain.handle('window:closeCurrent', async event => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    logger.warn('close_current.failed', { reason: 'window_not_found' })
    return { success: false, error: t('error.windowNotFound') }
  }

  logger.info('close_current', { windowId: targetWindow.id })
  targetWindow.close()
  return { success: true }
})

ipcMain.handle('window:isSettingsPinned', async event => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)
  if (!targetWindow || targetWindow.isDestroyed()) {
    return false
  }
  return targetWindow.isAlwaysOnTop()
})

ipcMain.handle('window:toggleSettingsPin', async event => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender)
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { success: false, pinned: false }
  }

  const current = targetWindow.isAlwaysOnTop()
  targetWindow.setAlwaysOnTop(!current)
  const result = targetWindow.isAlwaysOnTop()
  logger.debug('toggle_settings_pin', { windowId: targetWindow.id, pinned: result })
  return { success: true, pinned: result }
})

ipcMain.handle('window:notifyRendererReady', async (event, windowKind?: string) => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    logger.warn('renderer_ready.failed', { windowKind, reason: 'window_not_found' })
    return { success: false, error: t('error.windowNotFound') }
  }

  if (windowKind === 'settings') {
    const handled = markSettingsWindowRendererReady(targetWindow)
    logger.info('renderer_ready.settings', { windowId: targetWindow.id, handled })
    return handled
      ? { success: true }
      : { success: false, error: t('error.settingsWindowMismatch') }
  }

  if (!targetWindow.isDestroyed() && !targetWindow.isVisible()) {
    targetWindow.show()
  }

  logger.info('renderer_ready', {
    windowId: targetWindow.id,
    windowKind,
    visible: targetWindow.isVisible()
  })
  return { success: true }
})

/**
 * 关闭欢迎窗口
 */
ipcMain.handle('window:closeWelcome', async () => {
  logger.info('close_welcome')
  closeWelcomeWindow()
  return { success: true }
})

ipcMain.handle('window:getScreenshotSettings', async () => {
  const settings = loadScreenshotSettings()
  logger.debug('get_screenshot_settings', { settings })
  return settings
})

ipcMain.handle('window:updateScreenshotSettings', async (_event, settings) => {
  logger.info('update_screenshot_settings', { settings })
  const savedSettings = saveScreenshotSettings(settings)
  logger.info('update_screenshot_settings.success', { settings: savedSettings })
  return savedSettings
})

/**
 * 打开外部链接
 */
ipcMain.handle('window:openExternal', async (_event, url: string) => {
  const safeUrl = toSafeExternalUrl(url)
  if (!safeUrl) {
    logger.warn('open_external.rejected', { url })
    return { success: false, error: t('error.onlyHttpMailtoProtocol') }
  }

  await shell.openExternal(safeUrl)
  logger.info('open_external.success', { url: safeUrl })
  return { success: true }
})

ipcMain.handle('window:openResource', async (_event, source: string, suggestedName?: string) => {
  const timer = logger.timer('open_resource', {
    source,
    suggestedName
  })
  const safeSource = toSafeResourceSource(source)
  if (!safeSource) {
    timer.done({ success: false, reason: 'unsupported_protocol' })
    return { success: false, error: t('error.onlyResourceProtocol') }
  }

  try {
    const fileName = sanitizeSuggestedFileName(suggestedName, 'resource.bin')
    await cleanupTempResources()
    const tempFilePath = path.join(TEMP_RESOURCE_DIR, `${Date.now()}-${fileName}`)

    await writeResourceToPath(safeSource, tempFilePath)
    const openError = await shell.openPath(tempFilePath)
    if (openError) {
      timer.done({ success: false, error: openError, path: tempFilePath })
      return { success: false, error: openError }
    }

    timer.done({ success: true, path: tempFilePath })
    return { success: true, path: tempFilePath }
  } catch (error: any) {
    timer.fail(error)
    return { success: false, error: error?.message || String(error) }
  }
})

ipcMain.handle('window:saveResource', async (_event, source: string, suggestedName?: string) => {
  const timer = logger.timer('save_resource', {
    source,
    suggestedName
  })
  const safeSource = toSafeResourceSource(source)
  if (!safeSource) {
    timer.done({ success: false, reason: 'unsupported_protocol' })
    return { success: false, error: t('error.onlyResourceProtocolSave') }
  }

  try {
    const fileName = sanitizeSuggestedFileName(suggestedName, 'download.bin')
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('downloads'), fileName)
    })

    if (result.canceled || !result.filePath) {
      timer.done({ success: false, canceled: true })
      return { success: false, canceled: true }
    }

    await writeResourceToPath(safeSource, result.filePath)
    timer.done({ success: true, path: result.filePath })
    return { success: true, path: result.filePath }
  } catch (error: any) {
    timer.fail(error)
    return { success: false, error: error?.message || String(error) }
  }
})

/**
 * 获取应用版本号
 */
ipcMain.handle('window:getAppVersion', async () => {
  return app.getVersion()
})

/**
 * 获取当前平台能力
 */
ipcMain.handle('window:getPlatformCapabilities', async () => {
  const capabilities = getPlatformCapabilities()
  logger.debug('get_platform_capabilities', { capabilities })
  return capabilities
})

/**
 * 窗口事件监听
 *
 * 使用 IPC 单向通信，渲染进程通过此接口注册监听器
 */
import { getWindowWatcher } from '../utils/windowWatcher'
import type { WindowEvent } from '../utils/windowWatcher'
import { getDesktopAwarenessService } from '../desktopAwareness/service'
import { migrateLegacyWatcherConfig, toLegacyWatcherConfig } from '../desktopAwareness/settings'

// 存储已注册的渲染进程
const registeredRenderers = new Set<BrowserWindow>()

// 全局事件监听器（只注册一次）
let globalListenerRegistered = false
let removeGlobalListener: (() => void) | null = null

// 窗口事件监听器注册
ipcMain.handle('window:startWatching', async event => {
  const timer = logger.timer('start_watching')
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) {
    timer.done({ success: false, reason: 'window_not_found' })
    return { success: false, error: t('error.cannotGetWindowInstance') }
  }

  // 添加到已注册列表
  registeredRenderers.add(window)
  logger.info('watcher.renderer_registered', {
    windowId: window.id,
    registeredCount: registeredRenderers.size
  })

  // 获取窗口监听器实例。原始 watcher 继续作为平台窗口事件来源；
  // 主动 AI 通知由 DesktopAwarenessService 统一决策。
  const watcher = getWindowWatcher()
  const awareness = getDesktopAwarenessService()

  await awareness.start()

  // 只注册一次全局事件监听器
  if (!globalListenerRegistered) {
    globalListenerRegistered = true
    removeGlobalListener = watcher.onWindowEvent((windowEvent: WindowEvent) => {
      // 向所有已注册的渲染进程发送事件
      for (const renderer of registeredRenderers) {
        if (!renderer.isDestroyed()) {
          renderer.webContents.send('window:event', windowEvent)
        }
      }
    })
  }

  // 窗口关闭时移除渲染进程
  window.on('closed', () => {
    registeredRenderers.delete(window)
    logger.info('watcher.renderer_closed', {
      windowId: window.id,
      registeredCount: registeredRenderers.size
    })

    // 如果没有渲染进程了，停止监听器并移除全局监听器
    if (registeredRenderers.size === 0) {
      if (removeGlobalListener) {
        removeGlobalListener()
        removeGlobalListener = null
        globalListenerRegistered = false
      }
      awareness.stop()
      watcher.stop()
      logger.info('watcher.stopped_after_last_renderer')
    }
  })

  timer.done({
    success: true,
    windowId: window.id,
    watcherActive: watcher.isActive(),
    awarenessActive: awareness.isActive(),
    globalListenerRegistered
  })
  return { success: true }
})

// 获取当前活跃窗口
ipcMain.handle('window:getActiveWindow', async () => {
  const watcher = getWindowWatcher()
  const currentWindow = watcher.getCurrentWindow()
  logger.debug('get_active_window', { currentWindow })
  return currentWindow
})

// 获取窗口历史记录
ipcMain.handle('window:getWindowHistory', async () => {
  const watcher = getWindowWatcher()
  const history = watcher.getWindowHistory()
  logger.debug('get_window_history', { count: history.length })
  return history
})

// 获取所有已知窗口
ipcMain.handle('window:getAllWindows', async () => {
  const watcher = getWindowWatcher()
  const windows = watcher.getAllWindows()
  logger.debug('get_all_windows', { count: windows.length })
  return windows
})

// 构建 AI 上下文
ipcMain.handle('window:buildAIContext', async () => {
  const watcher = getWindowWatcher()
  const context = watcher.buildAIContext()
  logger.debug('build_ai_context', { context })
  return context
})

// 获取窗口监听配置
ipcMain.handle('window:getWatcherConfig', async () => {
  const awareness = getDesktopAwarenessService()
  const settings = await awareness.getSettings()
  const config = toLegacyWatcherConfig(settings, await getWindowWatcher().getConfig())
  logger.debug('get_watcher_config', { config })
  return config
})

// 更新窗口监听配置
ipcMain.handle('window:updateWatcherConfig', async (_event, config) => {
  const timer = logger.timer('update_watcher_config', { config })
  const awareness = getDesktopAwarenessService()
  await awareness.updateSettings(migrateLegacyWatcherConfig(config))
  timer.done()
  return { success: true }
})

// 重置窗口监听配置
ipcMain.handle('window:resetWatcherConfig', async () => {
  const timer = logger.timer('reset_watcher_config')
  const awareness = getDesktopAwarenessService()
  const settings = await awareness.resetSettings()
  const config = toLegacyWatcherConfig(settings, await getWindowWatcher().getConfig())
  timer.done({ config })
  return { success: true, config }
})

ipcMain.handle('desktopAwareness:getSettings', async () => {
  const awareness = getDesktopAwarenessService()
  return awareness.getSettings()
})

ipcMain.handle('desktopAwareness:updateSettings', async (_event, patch) => {
  const awareness = getDesktopAwarenessService()
  const settings = await awareness.updateSettings(patch)
  return { success: true, settings }
})

ipcMain.handle('desktopAwareness:resetSettings', async () => {
  const awareness = getDesktopAwarenessService()
  const settings = await awareness.resetSettings()
  return { success: true, settings }
})

ipcMain.handle('desktopAwareness:getSnapshot', async () => {
  const awareness = getDesktopAwarenessService()
  await awareness.getSettings()
  return awareness.getSnapshot()
})

ipcMain.handle('desktopScene:getSettings', async () => loadDesktopSceneSettings())

ipcMain.handle('desktopScene:updateSettings', async (_event, patch) =>
  saveDesktopSceneSettings({ ...(await loadDesktopSceneSettings()), ...(patch || {}) })
)

ipcMain.handle('desktopScene:resetSettings', async () => resetDesktopSceneSettings())

ipcMain.handle('desktopScene:getSnapshot', async () => getCurrentDesktopSceneSnapshot())

ipcMain.handle('personality:getSettings', async () => loadPersonalitySettings())

ipcMain.handle('personality:updateSettings', async (_event, patch) =>
  savePersonalitySettings({ ...(await loadPersonalitySettings()), ...(patch || {}) })
)

ipcMain.handle('personality:resetSettings', async () => resetPersonalitySettings())

ipcMain.handle('personality:getPrompt', async () =>
  buildPersonalitySystemPrompt(await loadPersonalitySettings())
)

// 手动下载 Cubism SDK
ipcMain.handle('window:downloadCubismCore', async () => {
  const timer = logger.timer('download_cubism_core')
  const { checkCubismCoreExists, showDownloadDialog, downloadWithProgress } =
    await import('../utils/downloadCubismCore')

  if (checkCubismCoreExists()) {
    timer.done({ alreadyExists: true })
    return { success: true, alreadyExists: true }
  }

  const userConfirmed = await showDownloadDialog()
  if (!userConfirmed) {
    timer.done({ cancelled: true })
    return { success: false, cancelled: true }
  }

  const downloadSuccess = await downloadWithProgress()
  timer.done({ downloadSuccess })
  return { success: downloadSuccess }
})
