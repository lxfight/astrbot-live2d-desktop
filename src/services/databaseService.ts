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
      'getAllConversations',
      () => window.electronAPI!.getAllConversations(),
      '获取会话列表失败'
    )
  }

  /**
   * 根据ID获取会话
   */
  async getConversationById(id: number): Promise<Conversation | null> {
    return this.callIPC(
      'getConversationById',
      () => window.electronAPI!.getConversationById(id),
      '获取会话失败'
    )
  }

  /**
   * 创建新会话
   */
  async createConversation(title: string): Promise<number> {
    return this.callIPC(
      'createConversation',
      () => window.electronAPI!.createConversation(title),
      '创建会话失败'
    )
  }

  /**
   * 更新会话标题
   */
  async updateConversationTitle(id: number, title: string): Promise<void> {
    return this.callIPC(
      'updateConversationTitle',
      () => window.electronAPI!.updateConversationTitle(id, title),
      '更新会话标题失败'
    )
  }

  /**
   * 删除会话
   */
  async deleteConversation(id: number): Promise<void> {
    return this.callIPC(
      'deleteConversation',
      () => window.electronAPI!.deleteConversation(id),
      '删除会话失败'
    )
  }

  /**
   * 设置活跃会话
   */
  async setActiveConversation(id: number): Promise<void> {
    return this.callIPC(
      'setActiveConversation',
      () => window.electronAPI!.setActiveConversation(id),
      '设置活跃会话失败'
    )
  }

  /**
   * 获取活跃会话
   */
  async getActiveConversation(): Promise<Conversation | null> {
    return this.callIPC(
      'getActiveConversation',
      () => window.electronAPI!.getActiveConversation(),
      '获取活跃会话失败'
    )
  }

  // ========== 消息管理 ==========

  /**
   * 保存消息
   */
  async saveMessage(params: SaveMessageParams): Promise<number> {
    return this.callIPC(
      'saveMessage',
      () => window.electronAPI!.saveMessage(params),
      '保存消息失败'
    )
  }

  /**
   * 获取会话的所有消息
   */
  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return this.callIPC(
      'getMessagesByConversation',
      () => window.electronAPI!.getMessagesByConversation(conversationId),
      '获取消息列表失败'
    )
  }

  /**
   * 根据ID获取消息
   */
  async getMessageById(id: number): Promise<Message | null> {
    return this.callIPC(
      'getMessageById',
      () => window.electronAPI!.getMessageById(id),
      '获取消息失败'
    )
  }

  /**
   * 删除消息
   */
  async deleteMessage(id: number): Promise<void> {
    return this.callIPC(
      'deleteMessage',
      () => window.electronAPI!.deleteMessage(id),
      '删除消息失败'
    )
  }

  /**
   * 搜索消息
   */
  async searchMessages(keyword: string, limit?: number): Promise<Message[]> {
    return this.callIPC(
      'searchMessages',
      () => window.electronAPI!.searchMessages(keyword, limit),
      '搜索消息失败'
    )
  }

  // ========== 统计数据 ==========

  /**
   * 获取日统计数据
   */
  async getDailyStatistics(date: string): Promise<DailyStatistics | null> {
    return this.callIPC(
      'getDailyStatistics',
      () => window.electronAPI!.getDailyStatistics(date),
      '获取统计数据失败'
    )
  }

  /**
   * 获取日期范围内的统计数据
   */
  async getStatisticsRange(startDate: string, endDate: string): Promise<DailyStatistics[]> {
    return this.callIPC(
      'getStatisticsRange',
      () => window.electronAPI!.getStatisticsRange(startDate, endDate),
      '获取统计数据失败'
    )
  }

  /**
   * 更新统计数据
   */
  async updateStatistics(params: UpdateStatisticsParams): Promise<void> {
    return this.callIPC(
      'updateStatistics',
      () => window.electronAPI!.updateStatistics(params),
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
    return this.callIPC(
      'getTotalStatistics',
      () => window.electronAPI!.getTotalStatistics(),
      '获取总统计数据失败'
    )
  }
}

// 导出单例
export const databaseService = new DatabaseService()
