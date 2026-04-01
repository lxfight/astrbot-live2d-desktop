import { ipcMain, shell, app, dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { showSettingsWindow, closeSettingsWindow } from '../windows/settingsWindow'
import { showHistoryWindow, closeHistoryWindow } from '../windows/historyWindow'
import { closeWelcomeWindow } from '../windows/welcomeWindow'
import { setAlwaysOnTop, setIgnoreMouseEvents, setWindowSize, resetWindowSize } from '../windows/mainWindow'
import { getPlatformCapabilities } from '../utils/platformCapabilities'
import { getDesktopFeatureSettings, updateDesktopFeatureSettings } from '../utils/tray'
import { loadScreenshotSettings, saveScreenshotSettings } from '../utils/screenshotSettings'

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const ALLOWED_RESOURCE_PROTOCOLS = new Set(['http:', 'https:', 'data:'])
const TEMP_RESOURCE_DIR = path.join(app.getPath('temp'), 'astrbot-live2d-history')

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

async function fetchResourceBuffer(source: string): Promise<Buffer> {
  const response = await fetch(source)
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
  showSettingsWindow(page)
  return { success: true }
})

/**
 * 关闭设置窗口
 */
ipcMain.handle('window:closeSettings', async () => {
  closeSettingsWindow()
  return { success: true }
})

ipcMain.handle('window:minimizeCurrent', async (event) => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    return { success: false, error: '未找到当前窗口' }
  }

  targetWindow.minimize()
  return { success: true }
})

ipcMain.handle('window:toggleMaximizeCurrent', async (event) => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    return { success: false, error: '未找到当前窗口' }
  }

  if (targetWindow.isMaximized()) {
    targetWindow.unmaximize()
  } else {
    targetWindow.maximize()
  }

  return { success: true, maximized: targetWindow.isMaximized() }
})

ipcMain.handle('window:isMaximizedCurrent', async (event) => {
  const targetWindow = getSenderWindow(event)
  return targetWindow ? targetWindow.isMaximized() : false
})

ipcMain.handle('window:closeCurrent', async (event) => {
  const targetWindow = getSenderWindow(event)
  if (!targetWindow) {
    return { success: false, error: '未找到当前窗口' }
  }

  targetWindow.close()
  return { success: true }
})

/**
 * 打开历史记录窗口
 */
ipcMain.handle('window:openHistory', async () => {
  showHistoryWindow()
  return { success: true }
})

/**
 * 关闭历史记录窗口
 */
ipcMain.handle('window:closeHistory', async () => {
  closeHistoryWindow()
  return { success: true }
})

/**
 * 关闭欢迎窗口
 */
ipcMain.handle('window:closeWelcome', async () => {
  closeWelcomeWindow()
  return { success: true }
})

/**
 * 设置窗口置顶
 */
ipcMain.handle('window:setAlwaysOnTop', async (_event, flag: boolean) => {
  updateDesktopFeatureSettings({ alwaysOnTop: flag })
  return { success: true }
})

/**
 * 获取窗口置顶状态
 */
ipcMain.handle('window:getAlwaysOnTop', async () => {
  return getDesktopFeatureSettings().alwaysOnTop
})

/**
 * 刷新窗口置顶状态（用于点击模型时确保置顶）
 * 只有当配置为“始终置顶”时才执行操作
 */
ipcMain.handle('window:refreshAlwaysOnTop', async () => {
  const { alwaysOnTop } = getDesktopFeatureSettings()
  
  if (alwaysOnTop) {
    setAlwaysOnTop(true)
  }
  return { success: true }
})

/**
 * 设置鼠标穿透
 */
ipcMain.handle('window:setIgnoreMouseEvents', async (_event, ignore: boolean) => {
  setIgnoreMouseEvents(ignore)
  return { success: true }
})

/**
 * 获取当前穿透模式状态
 */
ipcMain.handle('window:getPassThroughMode', async () => {
  return getDesktopFeatureSettings().fullPassThrough
})

ipcMain.handle('window:getDesktopFeatureSettings', async () => {
  return getDesktopFeatureSettings()
})

ipcMain.handle('window:updateDesktopFeatureSettings', async (_event, config) => {
  return updateDesktopFeatureSettings(config)
})

ipcMain.handle('window:getScreenshotSettings', async () => {
  return loadScreenshotSettings()
})

ipcMain.handle('window:updateScreenshotSettings', async (_event, settings) => {
  return saveScreenshotSettings(settings)
})

/**
 * 设置窗口大小
 */
ipcMain.handle('window:setSize', async (_event, width: number, height: number) => {
  if (typeof width !== 'number' || typeof height !== 'number' || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { success: false, error: 'width 和 height 必须为正整数' }
  }
  setWindowSize(width, height)
  return { success: true }
})

/**
 * 重置窗口大小（全屏）
 */
ipcMain.handle('window:resetSize', async () => {
  resetWindowSize()
  return { success: true }
})

/**
 * 打开外部链接
 */
ipcMain.handle('window:openExternal', async (_event, url: string) => {
  const safeUrl = toSafeExternalUrl(url)
  if (!safeUrl) {
    return { success: false, error: '仅支持打开 http/https/mailto 协议链接' }
  }

  await shell.openExternal(safeUrl)
  return { success: true }
})

ipcMain.handle('window:openResource', async (_event, source: string, suggestedName?: string) => {
  const safeSource = toSafeResourceSource(source)
  if (!safeSource) {
    return { success: false, error: '仅支持打开 http/https/data 协议资源' }
  }

  try {
    const fileName = sanitizeSuggestedFileName(suggestedName, 'resource.bin')
    await cleanupTempResources()
    const tempFilePath = path.join(TEMP_RESOURCE_DIR, `${Date.now()}-${fileName}`)

    await writeResourceToPath(safeSource, tempFilePath)
    const openError = await shell.openPath(tempFilePath)
    if (openError) {
      return { success: false, error: openError }
    }

    return { success: true, path: tempFilePath }
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) }
  }
})

ipcMain.handle('window:saveResource', async (_event, source: string, suggestedName?: string) => {
  const safeSource = toSafeResourceSource(source)
  if (!safeSource) {
    return { success: false, error: '仅支持保存 http/https/data 协议资源' }
  }

  try {
    const fileName = sanitizeSuggestedFileName(suggestedName, 'download.bin')
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('downloads'), fileName),
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    await writeResourceToPath(safeSource, result.filePath)
    return { success: true, path: result.filePath }
  } catch (error: any) {
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
  return getPlatformCapabilities()
})

/**
 * 窗口事件监听
 * 
 * 使用 IPC 单向通信，渲染进程通过此接口注册监听器
 */
import { getWindowWatcher } from '../utils/windowWatcher'
import type { WindowEvent } from '../utils/windowWatcher'
import { bridgeClient } from '../main'
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
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) {
    return { success: false, error: '无法获取窗口实例' }
  }

  // 添加到已注册列表
  registeredRenderers.add(window)

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
      if (!bridgeClient?.isConnected()) return
      const session = bridgeClient.getSession()
      const userName = getUserName()?.trim() || 'Desktop User'
      bridgeClient.sendMessage({
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
      })
    })
  }
  await watcher.startAppLaunchDetection()

  // 窗口关闭时移除渲染进程
  window.on('closed', () => {
    registeredRenderers.delete(window)

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
    }
  })

  return { success: true }
})

// 获取当前活跃窗口
ipcMain.handle('window:getActiveWindow', async () => {
  const watcher = getWindowWatcher()
  return watcher.getCurrentWindow()
})

// 获取窗口历史记录
ipcMain.handle('window:getWindowHistory', async () => {
  const watcher = getWindowWatcher()
  return watcher.getWindowHistory()
})

// 获取所有已知窗口
ipcMain.handle('window:getAllWindows', async () => {
  const watcher = getWindowWatcher()
  return watcher.getAllWindows()
})

// 构建 AI 上下文
ipcMain.handle('window:buildAIContext', async () => {
  const watcher = getWindowWatcher()
  return watcher.buildAIContext()
})

// 获取窗口监听配置
ipcMain.handle('window:getWatcherConfig', async () => {
  const watcher = getWindowWatcher()
  return await watcher.getConfig()
})

// 更新窗口监听配置
ipcMain.handle('window:updateWatcherConfig', async (_event, config) => {
  const watcher = getWindowWatcher()
  await watcher.updateConfig(config)
  // 配置更新后重新同步应用启动检测
  await watcher.startAppLaunchDetection()
  return { success: true }
})

// 重置窗口监听配置
ipcMain.handle('window:resetWatcherConfig', async () => {
  const watcher = getWindowWatcher()
  await watcher.resetConfig()
  // 配置重置后重新同步应用启动检测
  await watcher.startAppLaunchDetection()
  return { success: true, config: await watcher.getConfig() }
})
