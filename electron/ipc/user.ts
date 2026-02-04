import { ipcMain } from 'electron'
import { setUserName, getUserName, getUserId } from '../database/schema'
import { createMainWindow } from '../windows/mainWindow'
import { closeWelcomeWindow } from '../windows/welcomeWindow'
import { createTray } from '../utils/tray'
import { initBridgeClient } from '../main'

/**
 * 设置用户名称
 */
ipcMain.handle('user:setUserName', async (event, name: string) => {
  setUserName(name)

  // 关闭欢迎窗口，创建主窗口
  closeWelcomeWindow()
  createMainWindow()
  createTray()

  // 初始化 Bridge 客户端
  initBridgeClient()

  return { success: true }
})

/**
 * 获取用户名称
 */
ipcMain.handle('user:getUserName', async () => {
  return getUserName()
})

/**
 * 获取用户ID
 */
ipcMain.handle('user:getUserId', async () => {
  return getUserId()
})
