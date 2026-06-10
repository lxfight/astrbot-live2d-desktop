import type { PerformElement } from '@/types/protocol'
import { extractHistoryRawText } from '@/utils/historyContent'
import { collectExpressionUsageKeys } from './performElementSummary'

/**
 * 表演记录持久化（从 Main.vue 抽出）
 *
 * 收到表演指令后保存历史消息、表演记录并更新统计数据，
 * 全部为 fire-and-forget 写入，失败仅记录日志不影响表演执行。
 */

export interface PerformanceRecordOptions {
  sequence: PerformElement[]
  sessionId: string
  performanceId: string
  serverUserName: string
  fallbackRawText: string
  saveFailedMessage: string
  resourceContext: {
    resourceBaseUrl: string
    resourcePath: string
    resourceToken: string
  }
}

export function recordPerformanceHistory(options: PerformanceRecordOptions): void {
  const {
    sequence,
    sessionId,
    performanceId,
    serverUserName,
    fallbackRawText,
    saveFailedMessage,
    resourceContext
  } = options

  const timestamp = Date.now()
  const date = new Date(timestamp)
  const dateStr = date.toISOString().split('T')[0]
  const hour = date.getHours()
  const rawText = extractHistoryRawText(sequence) || fallbackRawText

  // 先保存一条incoming消息记录（服务器发来的表演）
  window.electron.history
    .saveMessage({
      messageId: performanceId,
      sessionId,
      userId: 'server',
      userName: serverUserName,
      messageType: 'friend',
      direction: 'incoming',
      content: sequence,
      rawText,
      timestamp,
      resourceContext
    })
    .then(
      (saveResult: { success?: boolean; localizedContent?: PerformElement[]; error?: string }) => {
        if (!saveResult?.success) {
          throw new Error(saveResult?.error || saveFailedMessage)
        }

        // 保存表演记录（关联到消息）
        return window.electron.history.savePerformance({
          messageId: performanceId,
          sessionId,
          sequence: saveResult.localizedContent || sequence,
          timestamp
        })
      }
    )
    .catch((error: unknown) => {
      console.error('[主窗口] 保存表演记录失败:', error)
    })

  // 统计各类元素数量
  let textCount = 0
  let imageCount = 0
  let audioCount = 0
  let videoCount = 0
  const motionUsage: Record<string, number> = {}
  const expressionUsage: Record<string, number> = {}

  sequence.forEach((element: PerformElement & { expressionId?: string }) => {
    switch (element.type) {
      case 'text':
        textCount++
        break
      case 'image':
        imageCount++
        break
      case 'tts':
      case 'audio':
        audioCount++
        break
      case 'video':
        videoCount++
        break
      case 'motion': {
        const motionKey = `${element.group}_${element.index}`
        motionUsage[motionKey] = (motionUsage[motionKey] || 0) + 1
        break
      }
      case 'expression': {
        for (const exprKey of collectExpressionUsageKeys(element)) {
          expressionUsage[exprKey] = (expressionUsage[exprKey] || 0) + 1
        }
        break
      }
    }
  })

  // 更新统计数据
  window.electron.history
    .updateStatistics({
      date: dateStr,
      hour,
      messageCount: 1,
      textCount,
      imageCount,
      audioCount,
      videoCount,
      motionUsage,
      expressionUsage
    })
    .catch((error: unknown) => {
      console.error('[主窗口] 更新统计数据失败:', error)
    })
}
