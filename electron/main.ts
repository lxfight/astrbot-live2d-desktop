import { app, BrowserWindow, ipcMain } from 'electron'
import { createMainWindow } from './windows/mainWindow'
import { showSettingsWindow } from './windows/settingsWindow'
import { showHistoryWindow } from './windows/historyWindow'
import { initDatabase, closeDatabase } from './database/schema'
import { L2DBridgeClient } from './protocol/client'
import { createTray, destroyTray } from './utils/tray'
import { cleanupShortcuts } from './ipc/shortcut'
import './ipc/connection'
import './ipc/window'
import './ipc/history'
import './ipc/model'
import './ipc/shortcut'

// 禁用 GPU 缓存以避免权限错误（可选）
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-program-cache')

// 禁用硬件加速（可选，解决某些渲染问题）
// app.disableHardwareAcceleration()

// 全局 WebSocket 客户端实例
export let bridgeClient: L2DBridgeClient | null = null

/**
 * 应用程序初始化
 */
async function initialize() {
  // 初始化数据库
  initDatabase()

  // 创建主窗口
  createMainWindow()

  // 创建系统托盘
  createTray()

  // 创建 WebSocket 客户端
  bridgeClient = new L2DBridgeClient()

  // 监听连接事件
  bridgeClient.on('connected', (payload) => {
    console.log('[主进程] 已连接到服务器:', payload)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bridge:connected', payload)
    })
  })

  bridgeClient.on('disconnected', (info) => {
    console.log('[主进程] 已断开连接:', info)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bridge:disconnected', info)
    })
  })

  bridgeClient.on('error', (error) => {
    console.error('[主进程] 连接错误:', error)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bridge:error', error)
    })
  })

  bridgeClient.on('perform:show', (payload) => {
    console.log('[主进程] 收到表演指令:', payload)
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('perform:show', payload)
    })
  })

  bridgeClient.on('perform:interrupt', () => {
    console.log('[主进程] 收到中断指令')
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('perform:interrupt')
    })
  })
}

/**
 * 应用程序就绪
 */
app.whenReady().then(() => {
  initialize()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

/**
 * 所有窗口关闭
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * 应用退出前清理
 */
app.on('before-quit', () => {
  if (bridgeClient) {
    bridgeClient.disconnect()
  }
  cleanupShortcuts()
  destroyTray()
  closeDatabase()
})

/**
 * 导出全局客户端实例
 */
export function getBridgeClient(): L2DBridgeClient | null {
  return bridgeClient
}
