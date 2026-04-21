import type {
  HistoryMessageQueryOptions,
  HistoryMessageRecord,
} from '../../src/shared/history'
import {
  clearHistory,
  deleteHistoryMessageByMessageId,
  getAverageResponseTime,
  getMessages,
  getMessagesCount,
  getStatistics,
  saveMessage,
  savePerformance,
  updateMessageContent,
  updatePerformanceSequenceByMessageId,
  updateStatistics,
  type PerformanceRecord,
  type StatisticsData,
} from '../database/schema'
import { localizeMessageContent } from '../database/messageResources'

function tryParseMessageContent(rawContent: unknown): unknown {
  if (typeof rawContent !== 'string') {
    return rawContent
  }

  try {
    return JSON.parse(rawContent)
  } catch {
    return rawContent
  }
}

export async function saveHistoryMessage(record: HistoryMessageRecord): Promise<any[]> {
  saveMessage({
    ...record,
    content: record.content,
  })

  try {
    const localized = await localizeMessageContent(record.messageId, record.content, {
      forceReplaceResources: true,
      resourceContext: record.resourceContext,
      strict: true,
    })

    updateMessageContent(record.messageId, localized.content)
    return localized.content
  } catch (error) {
    deleteHistoryMessageByMessageId(record.messageId)
    throw error
  }
}

export async function getHistoryMessages(options: HistoryMessageQueryOptions): Promise<{
  messages: any[]
  total: number
  repairedCount: number
}> {
  const queryOptions = {
    limit: options.limit,
    offset: options.offset,
    startDate: options.startDate,
    endDate: options.endDate,
    messageType: options.messageType,
    direction: options.direction,
    keyword: options.keyword,
  }

  const messages = getMessages(queryOptions)
  let repairedCount = 0

  if (options.repairOffline) {
    for (const message of messages) {
      const messageId = typeof message?.message_id === 'string' ? message.message_id : ''
      if (!messageId) {
        continue
      }

      const parsedContent = tryParseMessageContent(message.content)
      const localized = await localizeMessageContent(messageId, parsedContent, {
        resourceContext: options.resourceContext,
        strict: false,
      })

      if (!localized.changed) {
        continue
      }

      updateMessageContent(messageId, localized.content)
      updatePerformanceSequenceByMessageId(messageId, localized.content)
      message.content = JSON.stringify(localized.content)
      repairedCount += 1
    }
  }

  return {
    messages,
    total: getMessagesCount(queryOptions),
    repairedCount,
  }
}

export function saveHistoryPerformance(record: PerformanceRecord): void {
  savePerformance(record)
}

export function updateHistoryStatistics(data: StatisticsData): void {
  updateStatistics(data)
}

export function getHistoryStatistics(startDate: string, endDate: string): any[] {
  return getStatistics(startDate, endDate)
}

export function getHistoryAverageResponseTime(startDate: number, endDate: number): number {
  return getAverageResponseTime(startDate, endDate)
}

export function clearHistoryStorage(): void {
  clearHistory()
}
