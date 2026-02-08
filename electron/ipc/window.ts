import { ipcMain, shell, app } from 'electron'
import { showSettingsWindow, closeSettingsWindow } from '../windows/settingsWindow'
import { showHistoryWindow, closeHistoryWindow } from '../windows/historyWindow'
import { closeWelcomeWindow } from '../windows/welcomeWindow'
import { getMainWindow, setAlwaysOnTop, setIgnoreMouseEvents, setWindowSize, resetWindowSize } from '../windows/mainWindow'
import { getUserConfig } from '../database/schema'

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
  await shell.openExternal(url)
  return { success: true }
})

/**
 * 获取应用版本号
 */
ipcMain.handle('window:getAppVersion', async () => {
  return app.getVersion()
})
