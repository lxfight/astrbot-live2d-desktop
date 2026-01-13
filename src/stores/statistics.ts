/**
 * 统计数据状态管理
 * 管理使用统计和数据分析
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { databaseService } from '@/services'
import { logger } from '@/utils/logger'
import type { DailyStatistics } from '@/types/history'

export const useStatisticsStore = defineStore('statistics', () => {
  // 状态
  const dailyStats = ref<DailyStatistics[]>([])
  const totalStats = ref({
    totalMessages: 0,
    totalConversations: 0,
    totalDuration: 0
  })
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // 计算属性

  /**
   * 最近7天的统计数据
   */
  const last7DaysStats = computed(() => {
    return dailyStats.value.slice(-7)
  })

  /**
   * 最近30天的统计数据
   */
  const last30DaysStats = computed(() => {
    return dailyStats.value.slice(-30)
  })

  /**
   * 总消息数趋势
   */
  const messageTrend = computed(() => {
    return dailyStats.value.map(stat => ({
      date: stat.stat_date,
      count: stat.total_messages
    }))
  })

  /**
   * 用户消息 vs AI 消息比例
   */
  const messageRatio = computed(() => {
    const total = totalStats.value.totalMessages
    if (total === 0) return { user: 0, ai: 0 }

    const userTotal = dailyStats.value.reduce((sum, stat) => sum + stat.user_messages, 0)
    const aiTotal = dailyStats.value.reduce((sum, stat) => sum + stat.ai_messages, 0)

    return {
      user: userTotal,
      ai: aiTotal,
      userPercent: Math.round((userTotal / total) * 100),
      aiPercent: Math.round((aiTotal / total) * 100)
    }
  })

  /**
   * 平均每天消息数
   */
  const averageMessagesPerDay = computed(() => {
    if (dailyStats.value.length === 0) return 0
    const total = dailyStats.value.reduce((sum, stat) => sum + stat.total_messages, 0)
    return Math.round(total / dailyStats.value.length)
  })

  /**
   * 平均会话时长（分钟）
   */
  const averageSessionDuration = computed(() => {
    if (dailyStats.value.length === 0) return 0
    const total = dailyStats.value.reduce((sum, stat) => sum + stat.total_duration, 0)
    const sessions = dailyStats.value.reduce((sum, stat) => sum + stat.session_count, 0)
    if (sessions === 0) return 0
    return Math.round(total / sessions / 60) // 转换为分钟
  })

  // 操作

  /**
   * 加载总统计数据
   */
  async function loadTotalStatistics() {
    isLoading.value = true
    error.value = null

    try {
      totalStats.value = await databaseService.getTotalStatistics()
      logger.info('总统计数据已加载', totalStats.value)
    } catch (err) {
      error.value = err as Error
      logger.error('加载总统计数据失败', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载日期范围内的统计数据
   */
  async function loadStatisticsRange(startDate: string, endDate: string) {
    isLoading.value = true
    error.value = null

    try {
      dailyStats.value = await databaseService.getStatisticsRange(startDate, endDate)
      logger.info(`已加载 ${dailyStats.value.length} 天的统计数据`)
    } catch (err) {
      error.value = err as Error
      logger.error('加载统计数据失败', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载最近N天的统计数据
   */
  async function loadRecentStatistics(days: number) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    await loadStatisticsRange(startStr, endStr)
  }

  /**
   * 加载今日统计数据
   */
  async function loadTodayStatistics() {
    const today = new Date().toISOString().split('T')[0]

    try {
      const stat = await databaseService.getDailyStatistics(today)
      if (stat) {
        const index = dailyStats.value.findIndex(s => s.stat_date === today)
        if (index !== -1) {
          dailyStats.value[index] = stat
        } else {
          dailyStats.value.push(stat)
        }
      }
    } catch (err) {
      error.value = err as Error
      logger.error('加载今日统计失败', err)
    }
  }

  /**
   * 更新统计数据
   */
  async function updateStatistics(params: {
    stat_date: string
    user_messages?: number
    ai_messages?: number
    text_messages?: number
    image_messages?: number
    voice_messages?: number
    total_duration?: number
    session_count?: number
  }) {
    try {
      await databaseService.updateStatistics(params)
      await loadTodayStatistics()
      await loadTotalStatistics()
      logger.debug('统计数据已更新', params)
    } catch (err) {
      error.value = err as Error
      logger.error('更新统计数据失败', err)
      throw err
    }
  }

  /**
   * 记录消息（自动更新统计）
   */
  async function recordMessage(type: 'user' | 'ai', messageType: string) {
    const today = new Date().toISOString().split('T')[0]
    const updates: any = { stat_date: today }

    if (type === 'user') {
      updates.user_messages = 1
    } else {
      updates.ai_messages = 1
    }

    if (messageType === 'text') {
      updates.text_messages = 1
    } else if (messageType === 'image') {
      updates.image_messages = 1
    } else if (messageType === 'voice') {
      updates.voice_messages = 1
    }

    await updateStatistics(updates)
  }

  /**
   * 记录会话时长
   */
  async function recordSessionDuration(durationInSeconds: number) {
    const today = new Date().toISOString().split('T')[0]
    await updateStatistics({
      stat_date: today,
      total_duration: durationInSeconds,
      session_count: 1
    })
  }

  return {
    // 状态
    dailyStats,
    totalStats,
    isLoading,
    error,

    // 计算属性
    last7DaysStats,
    last30DaysStats,
    messageTrend,
    messageRatio,
    averageMessagesPerDay,
    averageSessionDuration,

    // 操作
    loadTotalStatistics,
    loadStatisticsRange,
    loadRecentStatistics,
    loadTodayStatistics,
    updateStatistics,
    recordMessage,
    recordSessionDuration
  }
})
