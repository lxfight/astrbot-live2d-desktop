/**
 * 会话状态管理
 * 管理当前活跃会话和消息列表
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { databaseService } from '@/services'
import { logger } from '@/utils/logger'
import type { Conversation, Message, SaveMessageParams } from '@/types/history'

export const useConversationStore = defineStore('conversation', () => {
  // 状态
  const conversations = ref<Conversation[]>([])
  const activeConversation = ref<Conversation | null>(null)
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // 计算属性
  const activeConversationId = computed(() => activeConversation.value?.id || null)
  const hasActiveConversation = computed(() => !!activeConversation.value)
  const messageCount = computed(() => messages.value.length)

  const sortedMessages = computed(() => {
    return [...messages.value].sort((a, b) => a.timestamp - b.timestamp)
  })

  const latestMessage = computed(() => {
    return sortedMessages.value[sortedMessages.value.length - 1] || null
  })

  // 操作

  /**
   * 加载所有会话
   */
  async function loadConversations() {
    isLoading.value = true
    error.value = null

    try {
      conversations.value = await databaseService.getAllConversations()
      logger.info(`已加载 ${conversations.value.length} 个会话`)
    } catch (err) {
      error.value = err as Error
      logger.error('加载会话列表失败', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载活跃会话
   */
  async function loadActiveConversation() {
    try {
      activeConversation.value = await databaseService.getActiveConversation()
      if (activeConversation.value) {
        logger.info('活跃会话:', activeConversation.value.title)
        await loadMessages(activeConversation.value.id)
      }
    } catch (err) {
      error.value = err as Error
      logger.error('加载活跃会话失败', err)
    }
  }

  /**
   * 创建新会话
   */
  async function createConversation(title: string) {
    isLoading.value = true
    error.value = null

    try {
      const id = await databaseService.createConversation(title)
      await loadConversations()
      await setActiveConversation(id)
      logger.info('创建新会话:', title)
      return id
    } catch (err) {
      error.value = err as Error
      logger.error('创建会话失败', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 设置活跃会话
   */
  async function setActiveConversation(id: number) {
    try {
      await databaseService.setActiveConversation(id)
      activeConversation.value = await databaseService.getConversationById(id)
      if (activeConversation.value) {
        await loadMessages(id)
        logger.info('切换到会话:', activeConversation.value.title)
      }
    } catch (err) {
      error.value = err as Error
      logger.error('设置活跃会话失败', err)
      throw err
    }
  }

  /**
   * 删除会话
   */
  async function deleteConversation(id: number) {
    isLoading.value = true
    error.value = null

    try {
      await databaseService.deleteConversation(id)
      if (activeConversation.value?.id === id) {
        activeConversation.value = null
        messages.value = []
      }
      await loadConversations()
      logger.info('删除会话:', id)
    } catch (err) {
      error.value = err as Error
      logger.error('删除会话失败', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载会话消息
   */
  async function loadMessages(conversationId: number) {
    isLoading.value = true
    error.value = null

    try {
      messages.value = await databaseService.getMessagesByConversation(conversationId)
      logger.info(`已加载 ${messages.value.length} 条消息`)
    } catch (err) {
      error.value = err as Error
      logger.error('加载消息失败', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 添加消息
   */
  async function addMessage(params: SaveMessageParams) {
    try {
      const id = await databaseService.saveMessage(params)
      const message = await databaseService.getMessageById(id)
      if (message) {
        messages.value.push(message)
        logger.debug('添加消息:', message.content.substring(0, 50))
      }
      return id
    } catch (err) {
      error.value = err as Error
      logger.error('添加消息失败', err)
      throw err
    }
  }

  /**
   * 删除消息
   */
  async function deleteMessage(id: number) {
    try {
      await databaseService.deleteMessage(id)
      messages.value = messages.value.filter(m => m.id !== id)
      logger.info('删除消息:', id)
    } catch (err) {
      error.value = err as Error
      logger.error('删除消息失败', err)
      throw err
    }
  }

  /**
   * 搜索消息
   */
  async function searchMessages(keyword: string, limit?: number) {
    isLoading.value = true
    error.value = null

    try {
      const results = await databaseService.searchMessages(keyword, limit)
      logger.info(`搜索到 ${results.length} 条消息`)
      return results
    } catch (err) {
      error.value = err as Error
      logger.error('搜索消息失败', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 清空当前会话消息（本地）
   */
  function clearMessages() {
    messages.value = []
  }

  return {
    // 状态
    conversations,
    activeConversation,
    messages,
    isLoading,
    error,

    // 计算属性
    activeConversationId,
    hasActiveConversation,
    messageCount,
    sortedMessages,
    latestMessage,

    // 操作
    loadConversations,
    loadActiveConversation,
    createConversation,
    setActiveConversation,
    deleteConversation,
    loadMessages,
    addMessage,
    deleteMessage,
    searchMessages,
    clearMessages
  }
})
