import { ipcMain } from 'electron'
import { setUserName, getUserName, getUserId } from '../database/schema'
import { createMainWindow } from '../windows/mainWindow'
import { closeWelcomeWindow } from '../windows/welcomeWindow'
import { createTray } from '../utils/tray'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.user')

/**
 * 设置用户名称
 */
ipcMain.handle('user:setUserName', async (_event, name: string) => {
  const timer = logger.timer('set_user_name', { nameLength: name.length })
  try {
    setUserName(name)

    // 关闭欢迎窗口，创建主窗口
    closeWelcomeWindow()
    createMainWindow()
    createTray()

    timer.done({ success: true })
    return { success: true }
  } catch (error) {
    console.error('[用户] 设置用户名失败:', error)
    timer.fail(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '设置用户名时发生未知错误'
    }
  }
})

/**
 * 获取用户名称
 */
ipcMain.handle('user:getUserName', async () => {
  const userName = getUserName()
  logger.debug('get_user_name', { exists: Boolean(userName) })
  return userName
})

/**
 * 获取用户ID
 */
ipcMain.handle('user:getUserId', async () => {
  const userId = getUserId()
  logger.debug('get_user_id', { userId })
  return userId
})
