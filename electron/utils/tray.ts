import { app, Tray, Menu, nativeImage } from 'electron'
import { showSettingsWindow } from '../windows/settingsWindow'
import { resolveAppIconPath } from './icon'
import { getDesktopBehaviorCoordinator } from '../desktopBehavior/coordinator'
import { t } from '../../src/i18n/mainProcess'

let tray: Tray | null = null

function revealMainOrOpenModelLibrary(reason: 'tray' | 'manual'): void {
  const coordinator = getDesktopBehaviorCoordinator()
  const snapshot = coordinator.getSnapshot()

  if (!snapshot.runtime.modelReady) {
    showSettingsWindow('model/library')
    return
  }

  coordinator.requestReveal(reason)
}

/**
 * 创建系统托盘
 */
export function createTray(): Tray | null {
  if (tray) return tray

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
  updateTrayMenu()

  tray.on('click', () => {
    revealMainOrOpenModelLibrary('tray')
  })

  return tray
}

function updateTrayMenu(): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: t('tray.showMain'),
      click: () => revealMainOrOpenModelLibrary('manual'),
    },
    {
      label: t('tray.settings'),
      click: () => showSettingsWindow(),
    },
    {
      label: t('tray.history'),
      click: () => showSettingsWindow('history/messages'),
    },
    { type: 'separator' },
    {
      label: t('tray.quit'),
      click: () => {
        app.quit()
      },
    },
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
