import { ipcMain } from 'electron'
import {
  getMessages,
  getMessagesCount,
  saveMessage,
  savePerformance,
  updateStatistics,
  getStatistics,
  clearHistory,
  type MessageRecord,
  type PerformanceRecord,
  type StatisticsData
} from '../database/schema'

/**
 * 查询消息历史
 */
ipcMain.handle('history:getMessages', async (_event, options: {
  limit?: number
  offset?: number
  startDate?: number
  endDate?: number
  messageType?: string
  direction?: string
  keyword?: string
}) => {
  try {
    const messages = getMessages(options)
    const total = getMessagesCount(options)
    return { success: true, data: messages, total }
  } catch (error: any) {
    console.error('[IPC] 查询消息历史失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 保存消息记录
 */
ipcMain.handle('history:saveMessage', async (_event, record: MessageRecord) => {
  try {
    saveMessage(record)
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 保存消息失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 保存表演记录
 */
ipcMain.handle('history:savePerformance', async (_event, record: PerformanceRecord) => {
  try {
    savePerformance(record)
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 保存表演记录失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 更新统计数据
 */
ipcMain.handle('history:updateStatistics', async (_event, data: StatisticsData) => {
  try {
    updateStatistics(data)
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 更新统计数据失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 获取统计数据
 */
ipcMain.handle('history:getStatistics', async (_event, startDate: string, endDate: string) => {
  try {
    const statistics = getStatistics(startDate, endDate)
    return { success: true, data: statistics }
  } catch (error: any) {
    console.error('[IPC] 获取统计数据失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 清空历史记录
 */
ipcMain.handle('history:clearHistory', async () => {
  try {
    clearHistory()
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 清空历史记录失败:', error)
    return { success: false, error: error.message }
  }
})
