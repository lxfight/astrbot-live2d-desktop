import { app, Tray, Menu, nativeImage } from 'electron'
import { showMainWindow, setMousePassThrough, getMainWindow, setAlwaysOnTop } from '../windows/mainWindow'
import { showSettingsWindow } from '../windows/settingsWindow'
import { showHistoryWindow } from '../windows/historyWindow'
import { enableGameMode, disableGameMode, isGameModeActive } from './gameMode'
import { resolveAppIconPath } from './icon'
import { getPlatformCapabilities } from './platformCapabilities'
import { loadDesktopFeatureSettings, saveDesktopFeatureSettings } from './desktopFeatureSettings'
import type { DesktopFeatureSettings } from '../../src/utils/desktopFeatureSettings'

let tray: Tray | null = null
const platformCapabilities = getPlatformCapabilities()

/**
 * 应用桌面功能设置
 */
export function applyDesktopFeatureSettings(settings: DesktopFeatureSettings): void {
  setAlwaysOnTop(settings.alwaysOnTop)
  setMousePassThrough(settings.fullPassThrough)

  const mainWindow = getMainWindow()
  if (mainWindow) {
    mainWindow.webContents.send('window:passThroughModeChanged', settings.fullPassThrough)
  }

  if (!platformCapabilities.gameMode.supported) {
    if (isGameModeActive()) {
      disableGameMode()
    }
    return
  }

  if (settings.autoDetectFullscreen && !isGameModeActive()) {
    enableGameMode()
  }

  if (!settings.autoDetectFullscreen && isGameModeActive()) {
    disableGameMode()
  }
}

export function getDesktopFeatureSettings(): DesktopFeatureSettings {
  return loadDesktopFeatureSettings()
}

export function updateDesktopFeatureSettings(
  patch: Partial<DesktopFeatureSettings>,
): DesktopFeatureSettings {
  const nextSettings = saveDesktopFeatureSettings(patch)
  applyDesktopFeatureSettings(nextSettings)
  updateTrayMenu()
  return nextSettings
}

/**
 * 创建系统托盘
 */
export function createTray(): Tray | null {
  if (tray) return tray

  // 创建托盘图标（使用默认图标）
  const iconPath = resolveAppIconPath()
  let icon: Electron.NativeImage

  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      console.warn(`[系统托盘] 图标加载失败，路径无效: ${iconPath}`)
      icon = nativeImage.createFromPath(process.execPath)
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  if (!icon.isEmpty() && process.platform === 'win32') {
    icon = icon.resize({ width: 16, height: 16 })
  }

  try {
    tray = new Tray(icon)
  } catch (error) {
    console.warn('[系统托盘] 创建失败，已降级为无托盘模式:', error)
    tray = null
    return null
  }

  tray.setToolTip('AstrBot Live2D')

  applyDesktopFeatureSettings(loadDesktopFeatureSettings())

  // 更新托盘菜单
  updateTrayMenu()

  // 点击托盘图标显示/隐藏主窗口
  tray.on('click', () => {
    showMainWindow()
  })

  return tray
}

/**
 * 更新托盘菜单
 */
function updateTrayMenu(): void {
  if (!tray) return

  // 创建右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showMainWindow()
    },
    {
      label: '设置',
      click: () => showSettingsWindow()
    },
    {
      label: '历史记录',
      click: () => showHistoryWindow()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

/**
 * 销毁托盘
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
