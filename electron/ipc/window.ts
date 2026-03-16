import { ipcMain, shell, app, dialog, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { showSettingsWindow, closeSettingsWindow } from '../windows/settingsWindow'
import { showHistoryWindow, closeHistoryWindow } from '../windows/historyWindow'
import { closeWelcomeWindow } from '../windows/welcomeWindow'
import { getMainWindow, setAlwaysOnTop, setIgnoreMouseEvents, setWindowSize, resetWindowSize } from '../windows/mainWindow'
import { getUserConfig } from '../database/schema'
import { getPlatformCapabilities } from '../utils/platformCapabilities'

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const ALLOWED_RESOURCE_PROTOCOLS = new Set(['http:', 'https:', 'data:'])

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
ipcMain.handle('window:openSettings', async () => {
  showSettingsWindow()
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
  setAlwaysOnTop(flag)
  return { success: true }
})

/**
 * 获取窗口置顶状态
 */
ipcMain.handle('window:getAlwaysOnTop', async () => {
  const mainWindow = getMainWindow()
  return mainWindow ? mainWindow.isAlwaysOnTop() : false
})

/**
 * 刷新窗口置顶状态（用于点击模型时确保置顶）
 * 只有当配置为“始终置顶”时才执行操作
 */
ipcMain.handle('window:refreshAlwaysOnTop', async () => {
  const alwaysOnTopConfig = getUserConfig('tray_always_on_top')
  const isAlwaysOnTop = alwaysOnTopConfig === null || alwaysOnTopConfig === 'true'
  
  if (isAlwaysOnTop) {
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
  const passThroughConfig = getUserConfig('tray_pass_through_mode')
  const isPassThroughMode = passThroughConfig === 'true'
  return isPassThroughMode
})

/**
 * 设置窗口大小
 */
ipcMain.handle('window:setSize', async (_event, width: number, height: number) => {
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
    const tempDir = path.join(app.getPath('temp'), 'astrbot-live2d-history')
    const tempFilePath = path.join(tempDir, `${Date.now()}-${fileName}`)

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
