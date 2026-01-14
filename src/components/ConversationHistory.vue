<template>
  <div class="conversation-history">
    <!-- 左侧：对话列表 -->
    <aside class="conversation-list">
      <div class="list-header">
        <h3>对话列表</h3>
        <button @click="createNewConversation" class="btn-new" title="创建新对话">
          ➕
        </button>
      </div>

      <div class="conversations">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          :class="['conversation-item', { active: selectedConversationId === conv.id }]"
          @click="selectConversation(conv.id)"
        >
          <div class="conv-info">
            <div class="conv-title">{{ conv.title }}</div>
            <div class="conv-meta">
              {{ formatDate(conv.updated_at) }} · {{ conv.message_count }} 条消息
            </div>
          </div>
          <button
            @click.stop="deleteConversation(conv.id)"
            class="btn-delete"
            title="删除对话"
          >
            🗑️
          </button>
        </div>
      </div>

      <div v-if="conversations.length === 0" class="empty-state">
        <p>暂无对话记录</p>
      </div>
    </aside>

    <!-- 右侧：消息详情 -->
    <main class="message-detail">
      <div v-if="selectedConversationId === null" class="empty-state">
        <p>请选择一个对话查看历史消息</p>
      </div>

      <div v-else class="messages-container">
        <div class="messages-header">
          <h3>{{ selectedConversationTitle }}</h3>
          <div class="message-count">共 {{ messages.length }} 条消息</div>
        </div>

        <div class="messages-list" ref="messagesList">
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['message-item', `message-${msg.sender}`]"
          >
            <div class="message-sender">
              {{ msg.sender === 'user' ? '👤 用户' : '🤖 AI' }}
            </div>
            <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
            <div class="message-content">
              <!-- 文本消息 -->
              <div
                v-if="msg.message_type === 'text' && msg.content"
                class="message-text"
                v-html="renderContent(msg.content)"
              ></div>

              <!-- 图片消息 -->
              <div v-else-if="msg.message_type === 'image'" class="message-image">
                📷 图片消息
              </div>

              <!-- 语音消息 -->
              <div v-else-if="msg.message_type === 'voice'" class="message-voice">
                🎤 {{ msg.content }}
              </div>

              <!-- 动作消息 -->
              <div v-else-if="msg.message_type === 'motion'" class="message-motion">
                💃 动作: {{ msg.content }}
              </div>

              <!-- 表情消息 -->
              <div v-else-if="msg.message_type === 'expression'" class="message-expression">
                😊 表情: {{ msg.content }}
              </div>

              <!-- TTS消息 -->
              <div v-else-if="msg.message_type === 'tts'" class="message-tts">
                🔊 语音合成: {{ msg.content }}
              </div>

              <!-- 其他类型 -->
              <div v-else class="message-other">
                {{ msg.content || '(无内容)' }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="messages.length === 0" class="empty-state">
          <p>此对话暂无消息</p>
        </div>

        <!-- 加载更多按钮 -->
        <div v-if="hasMore" class="load-more">
          <button @click="loadMoreMessages" :disabled="loading">
            {{ loading ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { renderMarkdownWithLatex } from '../utils/markdown'
import type { Conversation, Message } from '../types/history'

import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'

const conversations = ref<Conversation[]>([])
const selectedConversationId = ref<number | null>(null)
const messages = ref<Message[]>([])
const loading = ref(false)
const currentPage = ref(0)
const pageSize = 50
const hasMore = ref(false)

const selectedConversationTitle = computed(() => {
  const conv = conversations.value.find(c => c.id === selectedConversationId.value)
  return conv?.title || ''
})

onMounted(async () => {
  await loadConversations()
})

// 加载对话列表
const loadConversations = async () => {
  if (!window.electronAPI) return

  try {
    const result = await window.electronAPI.dbGetConversations()
    conversations.value = result

    // 自动选择激活的对话
    const activeConv = conversations.value.find(c => c.is_active === 1)
    if (activeConv) {
      await selectConversation(activeConv.id)
    }
  } catch (error) {
    console.error('[对话历史] 加载对话列表失败:', error)
  }
}

// 选择对话
const selectConversation = async (conversationId: number) => {
  selectedConversationId.value = conversationId
  currentPage.value = 0
  messages.value = []
  await loadMessages()
}

// 加载消息
const loadMessages = async () => {
  if (!window.electronAPI || selectedConversationId.value === null) return

  loading.value = true
  try {
    const offset = currentPage.value * pageSize
    const result = await window.electronAPI.dbGetMessages(
      selectedConversationId.value,
      pageSize,
      offset
    )

    if (currentPage.value === 0) {
      messages.value = result
    } else {
      messages.value = [...messages.value, ...result]
    }

    hasMore.value = result.length === pageSize
  } catch (error) {
    console.error('[对话历史] 加载消息失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载更多消息
const loadMoreMessages = async () => {
  currentPage.value++
  await loadMessages()
}

// 创建新对话
const createNewConversation = async () => {
  if (!window.electronAPI) return

  const title = `新对话 ${new Date().toLocaleString()}`
  try {
    const convId = await window.electronAPI.dbCreateConversation(title)
    await loadConversations()
    await selectConversation(convId)
  } catch (error) {
    console.error('[对话历史] 创建对话失败:', error)
  }
}

// 删除对话
const deleteConversation = async (conversationId: number) => {
  if (!window.electronAPI) return
  if (!confirm('确定要删除这个对话吗？此操作不可恢复。')) return

  try {
    await window.electronAPI.dbDeleteConversation(conversationId)

    if (selectedConversationId.value === conversationId) {
      selectedConversationId.value = null
      messages.value = []
    }

    await loadConversations()
  } catch (error) {
    console.error('[对话历史] 删除对话失败:', error)
  }
}

// 渲染消息内容
const renderContent = (content: string): string => {
  return renderMarkdownWithLatex(content)
}

// 格式化日期
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

  return date.toLocaleDateString('zh-CN')
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.conversation-history {
  display: flex;
  gap: 16px;
  height: 100%;
  min-height: 560px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* 左侧对话列表 */
.conversation-list {
  width: 280px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-header {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.btn-new {
  width: 32px;
  height: 32px;
  border: none;
  background: #4a9eff;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-new:hover {
  background: #3a8eef;
  transform: translateY(-1px);
}

.conversations {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
  color: rgba(255, 255, 255, 0.85);
}

.conversation-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.conversation-item.active {
  background: rgba(74, 158, 255, 0.18);
  border-left: 3px solid #4a9eff;
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.95);
}

.conv-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.btn-delete {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  transition: opacity 0.2s;
  color: rgba(255, 255, 255, 0.7);
}

.btn-delete:hover {
  opacity: 1;
}

/* 右侧消息详情 */
.message-detail {
  flex: 1;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages-header {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.messages-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.message-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message-item {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.message-item.message-user {
  background: rgba(74, 158, 255, 0.12);
  border-color: rgba(74, 158, 255, 0.3);
}

.message-item.message-ai {
  background: rgba(255, 255, 255, 0.05);
}

.message-sender {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.85);
}

.message-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
}

.message-text :deep(pre) {
  background: rgba(0, 0, 0, 0.6);
  color: #f8f8f2;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}

.message-text :deep(code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.message-text :deep(.katex-display) {
  margin: 8px 0;
  overflow-x: auto;
}

.message-image,
.message-voice,
.message-motion,
.message-expression,
.message-tts,
.message-other {
  color: rgba(255, 255, 255, 0.65);
  font-style: italic;
}

.load-more {
  padding: 16px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.load-more button {
  padding: 8px 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.load-more button:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.2);
  border-color: rgba(74, 158, 255, 0.5);
}

.load-more button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
}
</style>
