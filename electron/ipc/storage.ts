import { ipcMain } from 'electron'
import { getStorageOverview } from '../services/storageStatsService'
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.storage')

ipcMain.handle('storage:getOverview', () => {
  const timer = logger.timer('get_overview')
  try {
    const data = getStorageOverview()
    timer.done({
      messageCount: data.messageCount,
      resourceTotalBytes: data.resourceTotalBytes,
      databaseFileBytes: data.databaseFileBytes
    })
    return { success: true, data }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[IPC] 获取存储概览失败:', error)
    timer.fail(error)
    return { success: false, error: message }
  }
})
