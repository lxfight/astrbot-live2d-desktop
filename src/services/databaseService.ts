/**
 * 数据库服务
 * 封装会话历史和统计数据的访问
 */

import { ElectronService } from './base'
import type {
  Conversation,
  Message,
  DailyStatistics,
  SaveMessageParams,
  UpdateStatisticsParams
} from '@/types/history'

export class DatabaseService extends ElectronService {
  // ========== 会话管理 ==========

  /**
   * 获取所有会话
   */
  async getAllConversations(): Promise<Conversation[]> {
    return this.callIPC(
      'dbGetConversations',
      () => window.electronAPI!.dbGetConversations(),
      '获取会话列表失败'
    )
  }

  /**
   * 根据ID获取会话
   */
  async getConversationById(id: number): Promise<Conversation | null> {
    const conversations = await this.getAllConversations()
    return conversations.find((conversation) => conversation.id === id) || null
  }

  /**
   * 创建新会话
   */
  async createConversation(title?: string): Promise<number> {
    return this.callIPC(
      'dbCreateConversation',
      () => window.electronAPI!.dbCreateConversation(title),
      '创建会话失败'
    )
  }

  /**
   * 更新会话标题
   */
  async updateConversationTitle(id: number, title: string): Promise<void> {
    await this.callIPC(
      'dbUpdateConversationTitle',
      () => window.electronAPI!.dbUpdateConversationTitle(id, title),
      '更新会话标题失败'
    )
  }

  /**
   * 删除会话
   */
  async deleteConversation(id: number): Promise<void> {
    await this.callIPC(
      'dbDeleteConversation',
      () => window.electronAPI!.dbDeleteConversation(id),
      '删除会话失败'
    )
  }

  /**
   * 设置活跃会话
   */
  async setActiveConversation(id: number): Promise<void> {
    await this.callIPC(
      'dbSetActiveConversation',
      () => window.electronAPI!.dbSetActiveConversation(id),
      '设置活跃会话失败'
    )
  }

  /**
   * 获取活跃会话
   */
  async getActiveConversation(): Promise<Conversation | null> {
    const conversation = await this.callIPC(
      'dbGetActiveConversation',
      () => window.electronAPI!.dbGetActiveConversation(),
      '获取活跃会话失败'
    )
    return conversation ?? null
  }

  // ========== 消息管理 ==========

  /**
   * 保存消息
   */
  async saveMessage(params: SaveMessageParams): Promise<number> {
    return this.callIPC(
      'dbSaveMessage',
      () => window.electronAPI!.dbSaveMessage(params),
      '保存消息失败'
    )
  }

  /**
   * 获取会话的所有消息
   */
  async getMessagesByConversation(
    conversationId: number,
    limit?: number,
    offset?: number
  ): Promise<Message[]> {
    if (limit !== undefined || offset !== undefined) {
      return this.callIPC(
        'dbGetMessages',
        () => window.electronAPI!.dbGetMessages(conversationId, limit, offset),
        '获取消息列表失败'
      )
    }

    const count = await this.callIPC(
      'dbGetMessageCount',
      () => window.electronAPI!.dbGetMessageCount(conversationId),
      '获取消息数量失败'
    )

    if (!count) return []

    return this.callIPC(
      'dbGetMessages',
      () => window.electronAPI!.dbGetMessages(conversationId, count, 0),
      '获取消息列表失败'
    )
  }

  /**
   * 根据ID获取消息
   */
  async getMessageById(id: number): Promise<Message | null> {
    const conversations = await this.getAllConversations()

    for (const conversation of conversations) {
      const messages = await this.getMessagesByConversation(conversation.id)
      const message = messages.find((item) => item.id === id)
      if (message) return message
    }

    return null
  }

  /**
   * 删除消息
   */
  async deleteMessage(id: number): Promise<void> {
    await this.callIPC(
      'dbDeleteMessage',
      () => window.electronAPI!.dbDeleteMessage(id),
      '删除消息失败'
    )
  }

  /**
   * 搜索消息
   */
  async searchMessages(keyword: string, limit?: number): Promise<Message[]> {
    const results: Message[] = []
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return results

    const conversations = await this.getAllConversations()

    for (const conversation of conversations) {
      const messages = await this.getMessagesByConversation(conversation.id)
      for (const message of messages) {
        const haystack = `${message.content ?? ''} ${message.raw_data ?? ''}`.toLowerCase()
        if (haystack.includes(normalized)) {
          results.push(message)
          if (limit && results.length >= limit) {
            return results
          }
        }
      }
    }

    return results
  }

  // ========== 统计数据 ==========

  /**
   * 获取日统计数据
   */
  async getDailyStatistics(date: string): Promise<DailyStatistics | null> {
    const stats = await this.callIPC(
      'dbGetStatistics',
      () => window.electronAPI!.dbGetStatistics(date, date),
      '获取统计数据失败'
    )
    return stats[0] ?? null
  }

  /**
   * 获取日期范围内的统计数据
   */
  async getStatisticsRange(startDate: string, endDate: string): Promise<DailyStatistics[]> {
    return this.callIPC(
      'dbGetStatistics',
      () => window.electronAPI!.dbGetStatistics(startDate, endDate),
      '获取统计数据失败'
    )
  }

  /**
   * 更新统计数据
   */
  async updateStatistics(params: UpdateStatisticsParams): Promise<void> {
    await this.callIPC(
      'dbUpdateStatistics',
      () => window.electronAPI!.dbUpdateStatistics(params),
      '更新统计数据失败'
    )
  }

  /**
   * 获取总统计数据
   */
  async getTotalStatistics(): Promise<{
    totalMessages: number
    totalConversations: number
    totalDuration: number
  }> {
    const totals = await this.callIPC(
      'dbGetTotalStatistics',
      () => window.electronAPI!.dbGetTotalStatistics(),
      '获取总统计数据失败'
    )
    const conversations = await this.getAllConversations()

    return {
      totalMessages: totals.total_messages ?? 0,
      totalConversations: conversations.length,
      totalDuration: totals.total_duration ?? 0
    }
  }
}

// 导出单例
export const databaseService = new DatabaseService()
