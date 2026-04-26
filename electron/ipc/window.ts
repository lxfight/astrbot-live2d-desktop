import { ipcMain, shell, app, dialog, BrowserWindow, net } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { showSettingsWindow, closeSettingsWindow, markSettingsWindowRendererReady } from '../windows/settingsWindow'
import { closeWelcomeWindow } from '../windows/welcomeWindow'
import { getPlatformCapabilities } from '../utils/platformCapabilities'
import { loadScreenshotSettings, saveScreenshotSettings } from '../utils/screenshotSettings'
import { decodeInlineDataUrl } from '../protocol/messageContent'
import {
  HISTORY_RESOURCE_PROTOCOL_SCHEME,
  getMessageResourceByUrl,
} from '../database/messageResources'
import { createScopedLogger } from '../utils/logger'

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const ALLOWED_RESOURCE_PROTOCOLS = new Set(['http:', 'https:', 'data:', `${HISTORY_RESOURCE_PROTOCOL_SCHEME}:`])
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
      throw new Error('本地历史资源不存在')
    }

    return Buffer.from(resource.data)
  }

  const inlineResource = decodeInlineDataUrl(source)
  if (inlineResource) {
    return inlineResource.buffer
  }

  const response = await net.fetch(source)
  if (!response.ok) {
    throw new Error(`资源请求失败 (${response.status})`)
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

ipcMain.handle('window:minimizeCurrent', async (event) => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    logger.warn('minimize_current.failed', { reason: 'window_not_found' })
    return { success: false, error: '未找到当前窗口' }
  }

  logger.info('minimize_current', { windowId: targetWindow.id })
  targetWindow.minimize()
  return { success: true }
})

ipcMain.handle('window:toggleMaximizeCurrent', async (event) => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    logger.warn('toggle_maximize_current.failed', { reason: 'window_not_found' })
    return { success: false, error: '未找到当前窗口' }
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
    maximized: targetWindow.isMaximized(),
  })
  return { success: true, maximized: targetWindow.isMaximized() }
})

ipcMain.handle('window:isMaximizedCurrent', async (event) => {
  const targetWindow = getSenderWindow(event)
  const maximized = targetWindow ? targetWindow.isMaximized() : false
  logger.debug('is_maximized_current', { windowId: targetWindow?.id, maximized })
  return maximized
})

ipcMain.handle('window:closeCurrent', async (event) => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    logger.warn('close_current.failed', { reason: 'window_not_found' })
    return { success: false, error: '未找到当前窗口' }
  }

  logger.info('close_current', { windowId: targetWindow.id })
  targetWindow.close()
  return { success: true }
})

ipcMain.handle('window:notifyRendererReady', async (event, windowKind?: string) => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    logger.warn('renderer_ready.failed', { windowKind, reason: 'window_not_found' })
    return { success: false, error: '未找到当前窗口' }
  }

  if (windowKind === 'settings') {
    const handled = markSettingsWindowRendererReady(targetWindow)
    logger.info('renderer_ready.settings', { windowId: targetWindow.id, handled })
    return handled
      ? { success: true }
      : { success: false, error: '设置窗口状态不匹配' }
  }

  if (!targetWindow.isDestroyed() && !targetWindow.isVisible()) {
    targetWindow.show()
  }

  logger.info('renderer_ready', {
    windowId: targetWindow.id,
    windowKind,
    visible: targetWindow.isVisible(),
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
    return { success: false, error: '仅支持打开 http/https/mailto 协议链接' }
  }

  await shell.openExternal(safeUrl)
  logger.info('open_external.success', { url: safeUrl })
  return { success: true }
})

ipcMain.handle('window:openResource', async (_event, source: string, suggestedName?: string) => {
  const timer = logger.timer('open_resource', {
    source,
    suggestedName,
  })
  const safeSource = toSafeResourceSource(source)
  if (!safeSource) {
    timer.done({ success: false, reason: 'unsupported_protocol' })
    return { success: false, error: '仅支持打开 http/https/data/history-resource 协议资源' }
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
    suggestedName,
  })
  const safeSource = toSafeResourceSource(source)
  if (!safeSource) {
    timer.done({ success: false, reason: 'unsupported_protocol' })
    return { success: false, error: '仅支持保存 http/https/data/history-resource 协议资源' }
  }

  try {
    const fileName = sanitizeSuggestedFileName(suggestedName, 'download.bin')
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('downloads'), fileName),
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
import { getBridgeConnectionController } from '../main'
import { getUserName } from '../database/schema'

// 存储已注册的渲染进程
const registeredRenderers = new Set<BrowserWindow>()

// 全局事件监听器（只注册一次）
let globalListenerRegistered = false
let removeGlobalListener: (() => void) | null = null

// 应用启动检测监听器（只注册一次）
let appLaunchListenerRegistered = false
let removeAppLaunchListener: (() => void) | null = null

function buildDesktopAppLaunchSystemPrompt(appName: string, userName: string): string {
  return [
    '[SYSTEM_EVENT:DESKTOP_APP_LAUNCH]',
    'This signal is automatically generated by the desktop client and is NOT a user-authored message.',
    `user_nickname: ${JSON.stringify(userName)}`,
    `detected_app: ${JSON.stringify(appName)}`,
    `event_time_utc: ${new Date().toISOString()}`,
    'guidance:',
    '- Treat this as contextual telemetry, not explicit user intent.',
    '- Do not claim screen details unless capture_screenshot is called.',
    '- Optional next actions: ignore, brief proactive comment, or capture_screenshot then respond.',
  ].join('\n')
}

// 窗口事件监听器注册
ipcMain.handle('window:startWatching', async (event) => {
  const timer = logger.timer('start_watching')
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) {
    timer.done({ success: false, reason: 'window_not_found' })
    return { success: false, error: '无法获取窗口实例' }
  }

  // 添加到已注册列表
  registeredRenderers.add(window)
  logger.info('watcher.renderer_registered', {
    windowId: window.id,
    registeredCount: registeredRenderers.size,
  })

  // 获取窗口监听器实例
  const watcher = getWindowWatcher()

  // 如果监听器未启动，启动它
  if (!watcher.isActive()) {
    await watcher.start()
  }

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

  // 启动应用启动检测并注册回调（只注册一次）
  if (!appLaunchListenerRegistered) {
    appLaunchListenerRegistered = true
    removeAppLaunchListener = watcher.onAppLaunch((appName: string) => {
      const controller = getBridgeConnectionController()
      if (!controller?.isConnected()) return
      const session = controller.getSession()
      if (!session) return
      const userName = getUserName()?.trim() || 'Desktop User'
      void controller.sendMessage({
        content: [
          {
            type: 'text',
            text: buildDesktopAppLaunchSystemPrompt(appName, userName),
          },
        ],
        metadata: {
          userId: session.userId,
          userName,
          sessionId: session.sessionId,
          messageType: 'notify',
        },
      }).catch((error) => {
        console.error('[窗口监听] 发送应用启动通知失败:', error)
        logger.error('app_launch_notify.failed', error, { appName })
      })
    })
  }
  await watcher.startAppLaunchDetection()

  // 窗口关闭时移除渲染进程
  window.on('closed', () => {
    registeredRenderers.delete(window)
    logger.info('watcher.renderer_closed', {
      windowId: window.id,
      registeredCount: registeredRenderers.size,
    })

    // 如果没有渲染进程了，停止监听器并移除全局监听器
    if (registeredRenderers.size === 0) {
      if (removeGlobalListener) {
        removeGlobalListener()
        removeGlobalListener = null
        globalListenerRegistered = false
      }
      if (removeAppLaunchListener) {
        removeAppLaunchListener()
        removeAppLaunchListener = null
        appLaunchListenerRegistered = false
      }
      watcher.stopAppLaunchDetection()
      watcher.stop()
      logger.info('watcher.stopped_after_last_renderer')
    }
  })

  timer.done({
    success: true,
    windowId: window.id,
    watcherActive: watcher.isActive(),
    globalListenerRegistered,
    appLaunchListenerRegistered,
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
  const watcher = getWindowWatcher()
  const config = await watcher.getConfig()
  logger.debug('get_watcher_config', { config })
  return config
})

// 更新窗口监听配置
ipcMain.handle('window:updateWatcherConfig', async (_event, config) => {
  const timer = logger.timer('update_watcher_config', { config })
  const watcher = getWindowWatcher()
  await watcher.updateConfig(config)
  // 配置更新后重新同步应用启动检测
  await watcher.startAppLaunchDetection()
  timer.done()
  return { success: true }
})

// 重置窗口监听配置
ipcMain.handle('window:resetWatcherConfig', async () => {
  const timer = logger.timer('reset_watcher_config')
  const watcher = getWindowWatcher()
  await watcher.resetConfig()
  // 配置重置后重新同步应用启动检测
  await watcher.startAppLaunchDetection()
  const config = await watcher.getConfig()
  timer.done({ config })
  return { success: true, config }
})
