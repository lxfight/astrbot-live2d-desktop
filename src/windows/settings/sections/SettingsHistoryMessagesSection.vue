<template>
  <section class="settings-section settings-section--fill">
    <div class="settings-section__header">
      <h2>消息列表</h2>
      <div class="history-toolbar-actions">
        <n-input
          v-model:value="keyword"
          placeholder="搜索消息..."
          clearable
          size="small"
          @update:value="handleSearch"
        >
          <template #prefix>
            <Search :size="14" />
          </template>
        </n-input>
        <n-select
          v-model:value="directionFilter"
          :options="directionOptions"
          placeholder="方向"
          clearable
          size="small"
          style="width: 100px"
          @update:value="handleDirectionFilterChange"
        />
        <n-button size="small" type="error" @click="handleClearHistory">清空</n-button>
        <n-button size="small" type="primary" @click="handleRefreshMessages">刷新</n-button>
      </div>
    </div>
    <p class="settings-section__desc">共 {{ totalMessages }} 条消息</p>

    <div class="message-list">
      <article
        v-for="msg in messages"
        :key="msg.id"
        :class="[
          'message-item',
          `message-item--${msg.direction}`,
        ]"
      >
        <div class="message-avatar">
          <span class="message-avatar__icon">
            <component :is="msg.direction === 'outgoing' ? User : Bot" :size="14" />
          </span>
        </div>

        <div class="message-bubble">
          <div class="message-bubble__header">
            <strong class="message-bubble__name">{{ getMessageAuthorLabel(msg) }}</strong>
            <span class="message-bubble__time">{{ formatTimestamp(msg.timestamp) }}</span>
          </div>

          <div class="message-bubble__body">
            <div
              v-for="(item, idx) in getMessagePreviewItems(msg.content)"
              :key="idx"
              :class="['content-item', `content-item--${item.type}`]"
            >
              <div v-if="item.type === 'text'" class="text-content" v-html="renderMarkdown(item.text)"></div>
              <div v-else-if="item.type === 'image'" class="image-content" @click.capture="openMediaViewer('image', item.src)">
                <n-image
                  :src="item.src"
                  :preview-src="item.src"
                  width="220"
                  object-fit="cover"
                  preview-disabled
                  :lazy="true"
                  style="pointer-events: none"
                />
              </div>
              <div
                v-else-if="item.type === 'audio'"
                class="voice-bubble"
                :class="{ playing: playingVoiceKey === getVoiceItemKey(msg, idx) }"
                @click="toggleVoicePlay(getVoiceItemKey(msg, idx))"
              >
                <div class="voice-bubble__icon">
                  <Mic :size="16" />
                </div>
                <div class="voice-bubble__wave">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
                <span class="voice-bubble__duration">{{ getVoiceDurationLabel(getVoiceItemKey(msg, idx)) }}</span>
                <audio
                  :ref="(el) => setVoiceRef(el, getVoiceItemKey(msg, idx))"
                  :src="item.src"
                  preload="metadata"
                  @loadedmetadata="onVoiceMetadataLoaded(getVoiceItemKey(msg, idx))"
                  @ended="onVoiceEnded(getVoiceItemKey(msg, idx))"
                ></audio>
              </div>
              <div v-else-if="item.type === 'video'" class="video-content" @click="openMediaViewer('video', item.src)">
                <div class="video-preview-wrapper">
                  <div class="video-play-hint"><Play :size="20" /></div>
                  <video class="video-player" :src="item.src" preload="metadata" playsinline muted></video>
                </div>
              </div>
              <div v-else-if="item.type === 'file'" class="file-content">
                <div class="file-header">
                  <div class="file-meta">
                    <FileText :size="16" />
                    <span class="file-name">{{ item.name }}</span>
                  </div>
                  <div class="file-actions">
                    <button class="file-action-btn" @click.stop="openHistoryFile(item)">
                      <ExternalLink :size="12" />
                    </button>
                    <button class="file-action-btn" @click.stop="downloadHistoryFile(item)">
                      <Download :size="12" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <n-pagination
      v-if="totalPages > 1"
      v-model:page="currentPage"
      :page-count="totalPages"
      :page-size="pageSize"
      show-size-picker
      :page-sizes="[10, 20, 50]"
      @update:page="handlePageChange"
      @update:page-size="handlePageSizeChange"
      class="history-pagination"
    />

    <SettingsHistoryMediaViewer
      v-model:visible="mediaViewerVisible"
      :type="mediaViewerType"
      :src="mediaViewerSrc"
    />
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { format } from 'date-fns'
import {
  Bot,
  Download,
  ExternalLink,
  FileText,
  Mic,
  Play,
  Search,
  User,
} from 'lucide-vue-next'
import {
  buildHistoryRenderableItems,
  getLruCacheEntry,
  parseHistoryContent,
  setLruCacheEntry,
  type HistoryContentElement,
  type HistoryRenderableItem,
} from '@/utils/historyContent'
import { configureMarked, renderBubbleMarkdown as renderMarkdownFromShared } from '@/utils/markedLatex'
import { useHistorySettingsDomain } from '../domains/createHistorySettingsDomain'
import SettingsHistoryMediaViewer from './SettingsHistoryMediaViewer.vue'

const {
  currentPage,
  directionFilter,
  directionOptions,
  downloadHistoryFile,
  handleClearHistory,
  handleDirectionFilterChange,
  handlePageChange,
  handlePageSizeChange,
  handleRefreshMessages,
  handleSearch,
  historyResourceBaseUrl,
  historyResourcePath,
  historyResourceToken,
  keyword,
  messages,
  openHistoryFile,
  pageSize,
  totalMessages,
  totalPages,
} = useHistorySettingsDomain()

configureMarked()

const HISTORY_PREVIEW_CACHE_LIMIT = 500
const MARKDOWN_CACHE_LIMIT = 500
const CONTENT_CACHE_LIMIT = 1000

const markdownRenderCache = new Map<string, string>()
const messageContentCache = new Map<string, HistoryContentElement[]>()
const messagePreviewCache = new Map<string, HistoryRenderableItem[]>()

const voiceRefs = new Map<string, HTMLAudioElement>()
const voiceDurationLabels = ref<Record<string, string>>({})
const playingVoiceKey = ref<string | null>(null)

const mediaViewerVisible = ref(false)
const mediaViewerType = ref<'image' | 'video' | null>(null)
const mediaViewerSrc = ref<string | null>(null)

function openMediaViewer(type: 'image' | 'video', src: string) {
  mediaViewerType.value = type
  mediaViewerSrc.value = src
  mediaViewerVisible.value = true
}

function setVoiceRef(element: any, key: string) {
  if (element) {
    const audioElement = element as HTMLAudioElement
    voiceRefs.set(key, audioElement)
    syncVoiceDurationLabel(key, audioElement)
    return
  }

  voiceRefs.delete(key)
  delete voiceDurationLabels.value[key]
}

function stopAllVoicePlayback() {
  for (const audio of voiceRefs.values()) {
    audio.pause()
    audio.currentTime = 0
  }

  playingVoiceKey.value = null
}

function toggleVoicePlay(key: string) {
  const audio = voiceRefs.get(key)
  if (!audio) {
    return
  }

  if (playingVoiceKey.value !== null && playingVoiceKey.value !== key) {
    const previousAudio = voiceRefs.get(playingVoiceKey.value)
    if (previousAudio) {
      previousAudio.pause()
      previousAudio.currentTime = 0
    }
    playingVoiceKey.value = null
  }

  if (playingVoiceKey.value === key) {
    audio.pause()
    audio.currentTime = 0
    playingVoiceKey.value = null
    return
  }

  void audio.play().then(() => {
    playingVoiceKey.value = key
  }).catch(() => {
    playingVoiceKey.value = null
  })
}

function onVoiceEnded(key: string) {
  if (playingVoiceKey.value === key) {
    playingVoiceKey.value = null
  }
}

function formatVoiceDuration(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return '--:--'
  }

  const totalSeconds = Math.max(0, Math.round(durationSeconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function syncVoiceDurationLabel(key: string, audio?: HTMLAudioElement | null) {
  const targetAudio = audio || voiceRefs.get(key)
  if (!targetAudio) {
    return
  }

  voiceDurationLabels.value[key] = formatVoiceDuration(targetAudio.duration)
}

function onVoiceMetadataLoaded(key: string) {
  syncVoiceDurationLabel(key)
}

function getVoiceDurationLabel(key: string): string {
  return voiceDurationLabels.value[key] || '--:--'
}

function formatTimestamp(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')
}

function renderMarkdown(text: string): string {
  if (!text) {
    return ''
  }

  const cached = getLruCacheEntry(markdownRenderCache, text)
  if (cached !== undefined) {
    return cached
  }

  const rendered = renderMarkdownFromShared(text).trim()
  return setLruCacheEntry(markdownRenderCache, text, rendered, MARKDOWN_CACHE_LIMIT)
}

function parseContent(content: string): HistoryContentElement[] {
  return parseHistoryContent(content, messageContentCache, CONTENT_CACHE_LIMIT)
}

function buildHistoryPreviewCacheKey(content: string): string {
  let hash = 0
  for (let index = 0; index < content.length; index += 1) {
    hash = ((hash << 5) - hash) + content.charCodeAt(index)
    hash |= 0
  }

  return `${historyResourceBaseUrl.value}::${historyResourcePath.value}::${historyResourceToken.value}::${content.length}::${hash}`
}

function getMessagePreviewItems(content: string): HistoryRenderableItem[] {
  const cacheKey = buildHistoryPreviewCacheKey(content)
  const cached = getLruCacheEntry(messagePreviewCache, cacheKey)
  if (cached !== undefined) {
    return cached
  }

  try {
    const parsed = parseContent(content)
    const items = buildHistoryRenderableItems(parsed, {
      includeTtsText: true,
      resourceBaseUrl: historyResourceBaseUrl.value,
      resourcePath: historyResourcePath.value,
      resourceToken: historyResourceToken.value,
    })

    return setLruCacheEntry(messagePreviewCache, cacheKey, items, HISTORY_PREVIEW_CACHE_LIMIT)
  } catch {
    return setLruCacheEntry(messagePreviewCache, cacheKey, [], HISTORY_PREVIEW_CACHE_LIMIT)
  }
}

function getVoiceItemKey(messageRecord: any, index: number): string {
  const messageKey = messageRecord?.message_id || messageRecord?.messageId || messageRecord?.id || messageRecord?.timestamp || 'message'
  return `${messageKey}:${index}`
}

function getMessageAuthorLabel(messageRecord: any): string {
  if (messageRecord.direction === 'outgoing') {
    return messageRecord.user_name || '我'
  }

  if (messageRecord.user_id === 'server' || messageRecord.user_id === 'bot') {
    return 'AstrBot'
  }

  return messageRecord.user_name || messageRecord.user_id || '未知来源'
}

onBeforeUnmount(() => {
  stopAllVoicePlayback()
  voiceRefs.clear()
  voiceDurationLabels.value = {}
  markdownRenderCache.clear()
  messageContentCache.clear()
  messagePreviewCache.clear()
})
</script>

<style scoped lang="scss">
@use './settings-history.scss';
</style>
