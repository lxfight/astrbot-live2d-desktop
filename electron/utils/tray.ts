import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { showMainWindow, hideMainWindow } from '../windows/mainWindow'
import { showSettingsWindow } from '../windows/settingsWindow'
import { showHistoryWindow } from '../windows/historyWindow'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let tray: Tray | null = null

/**
 * 创建系统托盘
 */
export function createTray(): Tray {
  // 创建托盘图标（使用默认图标）
  const iconPath = path.join(__dirname, '../../resources/icon.png')
  let icon: Electron.NativeImage

  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      // 如果图标不存在，创建一个简单的图标
      icon = nativeImage.createEmpty()
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('AstrBot Live2D')

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

  // 点击托盘图标显示/隐藏主窗口
  tray.on('click', () => {
    showMainWindow()
  })

  return tray
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
