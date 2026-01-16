<template>
  <div class="conversation-history">
    <aside class="conversation-list">
      <div class="list-header">
        <h3>对话列表</h3>
        <button @click="createNewConversation" class="btn-new" title="创建新对话">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="M10 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="conversations.length === 0" class="empty-state">
        <p>暂无对话记录</p>
      </div>
    </aside>

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
              <span class="sender-badge">
                <svg v-if="msg.sender === 'user'" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
                  <circle cx="12" cy="5" r="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M12 7v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M8 16h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                  <path d="M16 16h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                </svg>
                <span>{{ msg.sender === 'user' ? '用户' : 'AI' }}</span>
              </span>
            </div>
            <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
            <div class="message-content">
              <div
                v-if="msg.message_type === 'text' && msg.content"
                class="message-text"
                v-html="renderContent(msg.content)"
              ></div>

              <div v-else-if="msg.message_type === 'image'" class="message-image">
                <span class="message-type">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                    <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>图片消息</span>
                </span>
              </div>

              <div v-else-if="msg.message_type === 'voice'" class="message-voice">
                <span class="message-type">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="2"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M12 19v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span>{{ msg.content }}</span>
                </span>
              </div>

              <div v-else-if="msg.message_type === 'motion'" class="message-motion">
                <span class="message-type">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2a3 3 0 1 0 3 3a3 3 0 0 0-3-3Z" stroke="currentColor" stroke-width="2"/>
                    <path d="M9 22l2-7-3-2 4-3 4 3-3 2 2 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>动作: {{ msg.content }}</span>
                </span>
              </div>

              <div v-else-if="msg.message_type === 'expression'" class="message-expression">
                <span class="message-type">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                    <path d="M8.5 10h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    <path d="M15.5 10h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    <path d="M8 15c1.2 1.4 2.6 2 4 2s2.8-.6 4-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span>表情: {{ msg.content }}</span>
                </span>
              </div>

              <div v-else-if="msg.message_type === 'tts'" class="message-tts">
                <span class="message-type">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                    <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M18 6a8 8 0 0 1 0 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <span>语音合成: {{ msg.content }}</span>
                </span>
              </div>

              <div v-else class="message-other">
                {{ msg.content || '(无内容)' }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="messages.length === 0" class="empty-state">
          <p>此对话暂无消息</p>
        </div>

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
import { renderMarkdownWithLatex } from '@/utils/markdown'
import type { Conversation, Message } from '@/types/history'

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

const loadConversations = async () => {
  if (!window.electronAPI) return

  try {
    const result = await window.electronAPI.dbGetConversations()
    conversations.value = result

    const activeConv = conversations.value.find(c => c.is_active === 1)
    if (activeConv) {
      await selectConversation(activeConv.id)
    }
  } catch (error) {
    console.error('[对话历史] 加载对话列表失败:', error)
  }
}

const selectConversation = async (conversationId: number) => {
  selectedConversationId.value = conversationId
  currentPage.value = 0
  messages.value = []
  await loadMessages()
}

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

const loadMoreMessages = async () => {
  currentPage.value++
  await loadMessages()
}

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

const deleteConversation = async (conversationId: number) => {
  if (!window.electronAPI) return
  if (!confirm('确定要删除这个对话吗？此操作不可恢复。')) return

  try {
    const result = await window.electronAPI.dbDeleteConversation(conversationId)
    if (!result || result.success === false) {
      throw new Error('删除对话失败')
    }

    if (selectedConversationId.value === conversationId) {
      selectedConversationId.value = null
      messages.value = []
    }

    await loadConversations()
  } catch (error) {
    console.error('[对话历史] 删除对话失败:', error)
    alert('删除对话失败，请稍后重试。')
  }
}

const renderContent = (content: string): string => {
  return renderMarkdownWithLatex(content)
}

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
  min-height: 0;
  padding: 0;
  border: none;
  color: var(--text);
}

.conversation-list {
  flex: 0 0 clamp(200px, 24%, 240px);
  width: auto;
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.btn-new {
  width: 32px;
  height: 32px;
  border: none;
  background: linear-gradient(135deg, rgba(255, 123, 182, 0.95), rgba(106, 168, 255, 0.95));
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-new:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.conversations {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-soft);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
  color: var(--text);
}

.conversation-item:hover {
  background: var(--border-soft);
}

.conversation-item.active {
  background: rgba(255, 123, 182, 0.14);
  border-left: 3px solid var(--accent);
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
  color: var(--text);
}

.conv-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.btn-delete {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s, color 0.2s;
  color: var(--text-muted);
}

.btn-delete:hover {
  opacity: 1;
  color: var(--text);
}

.message-detail {
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.messages-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.message-count {
  font-size: 12px;
  color: var(--text-muted);
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

.message-item {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 10px;
  background: var(--glass-strong);
  border: 1px solid var(--border-soft);
}

.message-item.message-user {
  background: rgba(255, 110, 199, 0.1);
  border-color: rgba(255, 110, 199, 0.26);
}

.message-sender {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--text);
}

.sender-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
}

.message-item.message-user .sender-badge {
  background: rgba(255, 110, 199, 0.1);
  border-color: rgba(255, 110, 199, 0.26);
}

.sender-badge svg {
  color: currentColor;
}

.message-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.message-text :deep(p) {
  margin: 0 0 8px 0;
}

.message-text :deep(p:last-child) {
  margin-bottom: 0;
}

.message-text :deep(ul),
.message-text :deep(ol) {
  margin: 0 0 8px 20px;
  padding: 0;
}

.message-text :deep(li) {
  margin: 2px 0;
}

.message-text :deep(h1),
.message-text :deep(h2),
.message-text :deep(h3),
.message-text :deep(h4) {
  margin: 10px 0 6px 0;
}

.message-text :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
}

.message-text :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-soft);
  margin: 10px 0;
}

.message-text :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.message-text :deep(th),
.message-text :deep(td) {
  border: 1px solid var(--border-soft);
  padding: 6px 8px;
}

.message-text :deep(th) {
  background: var(--border-soft);
}

.message-text :deep(a) {
  color: var(--accent-2);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.message-text :deep(pre) {
  background: var(--input-bg);
  color: var(--text);
  border: 1px solid var(--border-soft);
  padding: 12px;
  border-radius: 10px;
  overflow-x: auto;
}

.message-text :deep(code) {
  background: var(--border-soft);
  color: var(--text);
  padding: 2px 6px;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.message-text :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 10px;
  border-left: 3px solid var(--border);
  background: var(--border-soft);
  color: var(--text-muted);
  border-radius: 10px;
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
  color: var(--text-muted);
  font-style: italic;
}

.message-type {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-style: normal;
  color: var(--text-muted);
}

.message-type svg {
  color: currentColor;
}

.load-more {
  padding: 16px;
  text-align: center;
  border-top: 1px solid var(--border-soft);
}

.load-more button {
  padding: 8px 24px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.load-more button:hover:not(:disabled) {
  background: rgba(255, 110, 199, 0.12);
  border-color: rgba(255, 110, 199, 0.3);
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
  color: var(--text-muted);
  font-size: 14px;
}
</style>
