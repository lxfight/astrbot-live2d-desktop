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
import { createScopedLogger } from '../utils/logger'

const logger = createScopedLogger('ipc.history')

/**
 * 查询消息历史
 */
ipcMain.handle('history:getMessages', async (_event, options: HistoryMessageQueryOptions) => {
  const timer = logger.timer('get_messages', { options })
  try {
    const result = await getHistoryMessages(options)
    timer.done({
      total: result.total,
      returned: result.messages.length,
      repairedCount: result.repairedCount,
    })
    return {
      success: true,
      data: result.messages,
      total: result.total,
      repairedCount: result.repairedCount,
    }
  } catch (error: any) {
    console.error('[IPC] 查询消息历史失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 保存消息记录
 */
ipcMain.handle('history:saveMessage', async (_event, record: HistoryMessageRecord) => {
  const timer = logger.timer('save_message', {
    messageId: record.messageId,
    sessionId: record.sessionId,
    messageType: record.messageType,
    direction: record.direction,
    contentType: Array.isArray(record.content) ? 'array' : typeof record.content,
    contentCount: Array.isArray(record.content) ? record.content.length : undefined,
    timestamp: record.timestamp,
  })
  try {
    const localizedContent = await saveHistoryMessage(record)
    timer.done({
      localizedContentCount: Array.isArray(localizedContent) ? localizedContent.length : 0,
    })
    return { success: true, localizedContent }
  } catch (error: any) {
    console.error('[IPC] 保存消息失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 保存表演记录
 */
ipcMain.handle('history:savePerformance', (_event, record: PerformanceRecord) => {
  const timer = logger.timer('save_performance', {
    messageId: record.messageId,
    sequenceCount: Array.isArray(record.sequence) ? record.sequence.length : 0,
    duration: record.duration,
    interrupted: record.interrupted,
  })
  try {
    saveHistoryPerformance(record)
    timer.done()
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 保存表演记录失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 更新统计数据
 */
ipcMain.handle('history:updateStatistics', (_event, data: StatisticsData) => {
  const timer = logger.timer('update_statistics', {
    date: data.date,
    hour: data.hour,
    messageCount: data.messageCount,
    textCount: data.textCount,
    imageCount: data.imageCount,
    audioCount: data.audioCount,
    videoCount: data.videoCount,
  })
  try {
    updateHistoryStatistics(data)
    timer.done()
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 更新统计数据失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 获取统计数据
 */
ipcMain.handle('history:getStatistics', (_event, startDate: string, endDate: string) => {
  const timer = logger.timer('get_statistics', { startDate, endDate })
  try {
    const statistics = getHistoryStatistics(startDate, endDate)
    timer.done({ count: statistics.length })
    return { success: true, data: statistics }
  } catch (error: any) {
    console.error('[IPC] 获取统计数据失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('history:getAverageResponseTime', (_event, startDate: number, endDate: number) => {
  const timer = logger.timer('get_average_response_time', { startDate, endDate })
  try {
    const averageResponseTime = getHistoryAverageResponseTime(startDate, endDate)
    timer.done({ averageResponseTime })
    return { success: true, data: averageResponseTime }
  } catch (error: any) {
    console.error('[IPC] 获取平均响应时长失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})

/**
 * 清空历史记录
 */
ipcMain.handle('history:clearHistory', () => {
  const timer = logger.timer('clear_history')
  try {
    clearHistoryStorage()
    timer.done()
    return { success: true }
  } catch (error: any) {
    console.error('[IPC] 清空历史记录失败:', error)
    timer.fail(error)
    return { success: false, error: error.message }
  }
})
