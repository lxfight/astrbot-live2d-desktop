import { ipcMain } from 'electron'
import { showSettingsWindow, closeSettingsWindow } from '../windows/settingsWindow'
import { showHistoryWindow, closeHistoryWindow } from '../windows/historyWindow'
import { setAlwaysOnTop, setIgnoreMouseEvents } from '../windows/mainWindow'

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
 * 设置窗口置顶
 */
ipcMain.handle('window:setAlwaysOnTop', async (event, flag: boolean) => {
  setAlwaysOnTop(flag)
  return { success: true }
})

/**
 * 设置鼠标穿透
 */
ipcMain.handle('window:setIgnoreMouseEvents', async (event, ignore: boolean) => {
  setIgnoreMouseEvents(ignore)
  return { success: true }
})
