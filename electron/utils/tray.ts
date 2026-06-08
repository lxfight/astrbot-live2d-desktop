import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { showSettingsWindow } from '../windows/settingsWindow'
import { resolveAppIconPath } from './icon'
import { getDesktopBehaviorCoordinator } from '../desktopBehavior/coordinator'
import { t } from '../../src/i18n/mainProcess'

let tray: Tray | null = null

function resolveTrayIconPath(): string {
  // macOS 托盘图标必须使用 PNG，icns 格式无法渲染
  if (process.platform === 'darwin') {
    const devPng = path.join(process.cwd(), 'resources', 'icon.png')
    if (fs.existsSync(devPng)) return devPng
    const packagedPng = path.join(process.resourcesPath, 'icon.png')
    if (fs.existsSync(packagedPng)) return packagedPng
  }

  return resolveAppIconPath()
}

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

  const iconPath = resolveTrayIconPath()
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

  if (!icon.isEmpty() && process.platform === 'darwin') {
    icon = icon.resize({ width: 22, height: 22 })
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
      click: () => revealMainOrOpenModelLibrary('manual')
    },
    {
      label: t('tray.settings'),
      click: () => showSettingsWindow()
    },
    {
      label: t('tray.history'),
      click: () => showSettingsWindow('history/messages')
    },
    { type: 'separator' },
    {
      label: t('tray.quit'),
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

/**
 * 更新托盘提示文字（连接状态）
 */
export function updateTrayTooltip(statusText: string): void {
  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(`AstrBot Live2D - ${statusText}`)
  }
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
