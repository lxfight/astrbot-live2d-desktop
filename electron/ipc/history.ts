import { ipcMain } from 'electron'
import {
  clearHistoryStorage,
  getHistoryAverageResponseTime,
  getHistoryMessages,
  getHistoryStatistics,
  saveHistoryMessage,
  saveHistoryPerformance,
  updateHistoryStatistics,
} from '../services/historyStorageService'
import type { PerformanceRecord, StatisticsData } from '../database/schema'
import type {
  HistoryMessageQueryOptions,
  HistoryMessageRecord,
} from '../../src/shared/history'

/**
 * 查询消息历史
 */
ipcMain.handle('history:getMessages', async (_event, options: HistoryMessageQueryOptions) => {
  try {
    const result = await getHistoryMessages(options)
    return {
      success: true,
      data: result.messages,
      total: result.total,
      repairedCount: result.repairedCount,
    }
  } catch (error: any) {
    console.error('[IPC] 查询消息历史失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 保存消息记录
 */
ipcMain.handle('history:saveMessage', async (_event, record: HistoryMessageRecord) => {
  try {
    const localizedContent = await saveHistoryMessage(record)
    return { success: true, localizedContent }
  } catch (error: any) {
    console.error('[IPC] 保存消息失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 保存表演记录
 */
ipcMain.handle('history:savePerformance', (_event, record: PerformanceRecord) => {
  try {
    saveHistoryPerformance(record)
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 保存表演记录失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 更新统计数据
 */
ipcMain.handle('history:updateStatistics', (_event, data: StatisticsData) => {
  try {
    updateHistoryStatistics(data)
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 更新统计数据失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 获取统计数据
 */
ipcMain.handle('history:getStatistics', (_event, startDate: string, endDate: string) => {
  try {
    const statistics = getHistoryStatistics(startDate, endDate)
    return { success: true, data: statistics }
  } catch (error: any) {
    console.error('[IPC] 获取统计数据失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('history:getAverageResponseTime', (_event, startDate: number, endDate: number) => {
  try {
    const averageResponseTime = getHistoryAverageResponseTime(startDate, endDate)
    return { success: true, data: averageResponseTime }
  } catch (error: any) {
    console.error('[IPC] 获取平均响应时长失败:', error)
    return { success: false, error: error.message }
  }
})

/**
 * 清空历史记录
 */
ipcMain.handle('history:clearHistory', () => {
  try {
    clearHistoryStorage()
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 清空历史记录失败:', error)
    return { success: false, error: error.message }
  }
})
