import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { showSettingsWindow } from '../windows/settingsWindow'
import { resolveAppIconPath } from './icon'
import { getDesktopBehaviorCoordinator } from '../desktopBehavior/coordinator'
import { getPluginManager, getPluginHost } from '../plugins'
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

  const template: Electron.MenuItemConstructorOptions[] = [
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
    }
  ]

  // 插件托盘菜单：运行中 + 声明 trayMenu 权限与菜单项的插件
  let pluginItemsAdded = false
  try {
    const manager = getPluginManager()
    const host = getPluginHost()
    for (const info of manager.listPlugins()) {
      if (info.status !== 'running' || !host.isRunning(info.manifest.id)) {
        continue
      }
      const permissions = info.manifest.permissions ?? []
      if (!permissions.includes('trayMenu')) {
        continue
      }
      for (const item of info.manifest.trayMenu ?? []) {
        pluginItemsAdded = true
        template.push({
          label: item.label || item.id,
          click: () => {
            host.sendTrayCommand(info.manifest.id, item.id)
          }
        })
      }
    }
  } catch {
    // 插件系统未初始化或已关闭：跳过插件菜单
  }

  if (pluginItemsAdded) {
    template.push({ type: 'separator' })
  }
  template.push({
    label: t('tray.quit'),
    click: () => {
      app.quit()
    }
  })

  tray.setContextMenu(Menu.buildFromTemplate(template))
}

/** 重建托盘菜单（插件启用/停用/安装后由调用方触发） */
export function refreshTrayMenu(): void {
  updateTrayMenu()
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
