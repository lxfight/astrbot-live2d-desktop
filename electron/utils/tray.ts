import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { showMainWindow, setMousePassThrough, getMainWindow, setAlwaysOnTop } from '../windows/mainWindow'
import { showSettingsWindow } from '../windows/settingsWindow'
import { showHistoryWindow } from '../windows/historyWindow'
import { enableGameMode, disableGameMode, isGameModeActive } from './gameMode'
import { getUserConfig, setUserConfig } from '../database/schema'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let tray: Tray | null = null
let isPassThroughMode = false // 穿透模式状态
let isAlwaysOnTop = true // 窗口置顶状态，默认为 true

/**
 * 加载托盘配置
 */
function loadTrayConfig(): void {
  // 从数据库加载配置
  const passThroughConfig = getUserConfig('tray_pass_through_mode')
  const alwaysOnTopConfig = getUserConfig('tray_always_on_top')
  const gameModeConfig = getUserConfig('tray_game_mode')

  // 恢复穿透模式
  if (passThroughConfig !== null) {
    isPassThroughMode = passThroughConfig === 'true'
    setMousePassThrough(isPassThroughMode)
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('window:passThroughModeChanged', isPassThroughMode)
    }
  }

  // 恢复窗口置顶
  if (alwaysOnTopConfig !== null) {
    isAlwaysOnTop = alwaysOnTopConfig === 'true'
    setAlwaysOnTop(isAlwaysOnTop)
  }

  // 恢复游戏模式
  if (gameModeConfig === 'true' && !isGameModeActive()) {
    enableGameMode()
  }
}

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

  // 加载保存的配置
  loadTrayConfig()

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
      label: '窗口置顶',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: () => {
        isAlwaysOnTop = !isAlwaysOnTop
        setAlwaysOnTop(isAlwaysOnTop)
        setUserConfig('tray_always_on_top', isAlwaysOnTop.toString())
        console.log(`[系统托盘] 窗口置顶: ${isAlwaysOnTop ? '开启' : '关闭'}`)
        updateTrayMenu()
      }
    },
    {
      label: '完全穿透模式',
      type: 'checkbox',
      checked: isPassThroughMode,
      click: () => {
        isPassThroughMode = !isPassThroughMode
        setMousePassThrough(isPassThroughMode)
        setUserConfig('tray_pass_through_mode', isPassThroughMode.toString())

        // 通知渲染进程穿透模式状态变化
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.webContents.send('window:passThroughModeChanged', isPassThroughMode)
        }

        updateTrayMenu()
      }
    },
    {
      label: '自动检测全屏应用',
      type: 'checkbox',
      checked: isGameModeActive(),
      click: () => {
        if (isGameModeActive()) {
          disableGameMode()
          setUserConfig('tray_game_mode', 'false')
        } else {
          enableGameMode()
          setUserConfig('tray_game_mode', 'true')
        }
        updateTrayMenu()
      }
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
