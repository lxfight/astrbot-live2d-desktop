<template>
  <div class="media-player">
    <!-- 音频播放器 -->
    <audio
      ref="audioRef"
      preload="auto"
      @abort="handleAudioAbort"
      @ended="handleAudioEnded"
      @error="handleAudioError"
      @stalled="handleAudioStalled"
    />

    <!-- 图片显示 -->
    <transition name="fade">
      <div v-if="currentImage" class="media-overlay image-overlay" @click="hideImage">
        <div class="media-card media-card--image" @click.stop>
          <div class="media-card__header">
            <button class="media-card__close" type="button" @click.stop="hideImage">关闭</button>
          </div>
          <img :src="currentImage" alt="表演图片" />
          <p class="media-card__hint">点击空白区域也可关闭</p>
        </div>
      </div>
    </transition>

    <!-- 视频播放器 -->
    <transition name="fade">
      <div v-if="currentVideo" class="media-overlay video-overlay" @click="hideVideo">
        <div class="media-card media-card--video" @click.stop>
          <div class="media-card__header">
            <button class="media-card__close" type="button" @click.stop="hideVideo">关闭</button>
          </div>
          <video
            ref="videoRef"
            :src="currentVideo"
            autoplay
            controls
            @ended="handleVideoEnded"
          />
          <p class="media-card__hint">点击空白区域也可关闭</p>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { isDirectResourceUrl, resolveResourceSource, type ResourceLike } from '@/utils/resourceUrl'

const audioRef = ref<HTMLAudioElement>()
const videoRef = ref<HTMLVideoElement>()
const currentImage = ref<string>()
const currentVideo = ref<string>()
const connectionStore = useConnectionStore()

let isAudioActive = false
let imageHideTimer: number | null = null
let activeAudioObjectUrl: string | null = null
let currentAudioSourceLog: Record<string, unknown> | null = null
let isResettingAudioElement = false

const AUDIO_READY_TIMEOUT_MS = 15000
const NETWORK_STATE_LABELS = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE']
const READY_STATE_LABELS = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA']

// 定义 emit
const emit = defineEmits<{
  audioStart: [audioElement: HTMLAudioElement]
  audioEnd: []
}>()

function isDataUrl(url: string): boolean {
  return url.startsWith('data:')
}

function previewUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null
  }

  if (isDataUrl(url)) {
    const separatorIndex = url.indexOf(',')
    const header = separatorIndex >= 0 ? url.slice(0, separatorIndex + 1) : url
    return `${header}<省略 ${Math.max(0, url.length - header.length)} 字符>`
  }

  if (url.length <= 240) {
    return url
  }

  return `${url.slice(0, 240)}...(总长 ${url.length} 字符)`
}

function buildAudioSourceLog(
  source: ResourceLike,
  resolvedUrl: string | null = null,
  playbackUrl: string | null = null,
  usesObjectUrl = false,
): Record<string, unknown> {
  const inline = typeof source.inline === 'string' ? source.inline.trim() : ''
  const url = typeof source.url === 'string' ? source.url.trim() : ''
  const rid = typeof source.rid === 'string' ? source.rid.trim() : ''

  let sourceKind = 'unknown'
  if (inline) {
    sourceKind = 'inline'
  } else if (rid) {
    sourceKind = 'rid'
  } else if (url) {
    sourceKind = 'url'
  }

  return {
    sourceKind,
    hasInline: Boolean(inline),
    hasRid: Boolean(rid),
    resolvedUrl: previewUrl(resolvedUrl),
    playbackUrl: previewUrl(playbackUrl),
    usesObjectUrl,
  }
}

function formatPlaybackError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || null,
    }
  }

  if (error && typeof error === 'object') {
    const errorLike = error as Record<string, unknown>
    return {
      name: typeof errorLike.name === 'string' ? errorLike.name : 'UnknownError',
      message: typeof errorLike.message === 'string' ? errorLike.message : String(error),
      code: typeof errorLike.code === 'number' ? errorLike.code : null,
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
  }
}

function describeAudioState(audioElement?: HTMLAudioElement): Record<string, unknown> | null {
  if (!audioElement) {
    return null
  }

  const mediaError = audioElement.error
  return {
    currentSrc: previewUrl(audioElement.currentSrc),
    networkState: NETWORK_STATE_LABELS[audioElement.networkState] || audioElement.networkState,
    readyState: READY_STATE_LABELS[audioElement.readyState] || audioElement.readyState,
    paused: audioElement.paused,
    ended: audioElement.ended,
    currentTime: Number.isFinite(audioElement.currentTime) ? audioElement.currentTime : null,
    duration: Number.isFinite(audioElement.duration) ? audioElement.duration : null,
    errorCode: mediaError?.code ?? null,
    errorMessage: mediaError?.message || null,
  }
}

function revokeActiveAudioObjectUrl() {
  if (!activeAudioObjectUrl) {
    return
  }

  URL.revokeObjectURL(activeAudioObjectUrl)
  activeAudioObjectUrl = null
}

function clearAudioElementSource(audioElement?: HTMLAudioElement) {
  if (!audioElement) {
    revokeActiveAudioObjectUrl()
    currentAudioSourceLog = null
    return
  }

  isResettingAudioElement = true
  try {
    audioElement.pause()
    try {
      audioElement.currentTime = 0
    } catch {
      // ignore invalid state when source is already unavailable
    }
    audioElement.removeAttribute('src')
    audioElement.load()
  } finally {
    isResettingAudioElement = false
  }

  revokeActiveAudioObjectUrl()
  currentAudioSourceLog = null
}

async function buildAudioPlaybackUrl(resolvedUrl: string): Promise<{ playbackUrl: string; usesObjectUrl: boolean }> {
  if (!isDataUrl(resolvedUrl)) {
    return {
      playbackUrl: resolvedUrl,
      usesObjectUrl: false,
    }
  }

  const response = await fetch(resolvedUrl)
  if (!response.ok) {
    throw new Error(`内联音频读取失败 (${response.status})`)
  }

  const blob = await response.blob()
  activeAudioObjectUrl = URL.createObjectURL(blob)
  return {
    playbackUrl: activeAudioObjectUrl,
    usesObjectUrl: true,
  }
}

function waitForAudioReady(audioElement: HTMLAudioElement, timeoutMs = AUDIO_READY_TIMEOUT_MS): Promise<void> {
  if (audioElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      audioElement.removeEventListener('canplay', handleCanPlay)
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audioElement.removeEventListener('error', handleError)
      audioElement.removeEventListener('abort', handleAbort)
    }

    const settle = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      callback()
    }

    const handleCanPlay = () => {
      settle(resolve)
    }

    const handleLoadedMetadata = () => {
      if (audioElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        settle(resolve)
      }
    }

    const handleError = () => {
      settle(() => reject(new Error('音频资源加载失败')))
    }

    const handleAbort = () => {
      settle(() => reject(new Error('音频资源加载被中止')))
    }

    const timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error(`音频资源加载超时 (${timeoutMs}ms)`)))
    }, timeoutMs)

    audioElement.addEventListener('canplay', handleCanPlay, { once: true })
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata)
    audioElement.addEventListener('error', handleError, { once: true })
    audioElement.addEventListener('abort', handleAbort, { once: true })
  })
}

/**
 * 播放音频（结构化资源对象）
 */
async function playAudio(source: ResourceLike, volume: number = 1.0) {
  const audioElement = audioRef.value
  if (!audioElement) return

  let resolvedAudioUrl: string | null = null
  let playbackAudioUrl: string | null = null
  let usesObjectUrl = false

  try {
    stopAudio()

    isAudioActive = true
    resolvedAudioUrl = resolveResourceSource(
      source,
      {
        resourceBaseUrl: connectionStore.resourceBaseUrl,
        resourcePath: connectionStore.resourcePath,
        resourceToken: connectionStore.resourceToken,
      }
    )

    if (!resolvedAudioUrl) {
      throw new Error('音频资源地址不可用')
    }

    const preparedPlayback = await buildAudioPlaybackUrl(resolvedAudioUrl)
    playbackAudioUrl = preparedPlayback.playbackUrl
    usesObjectUrl = preparedPlayback.usesObjectUrl
    currentAudioSourceLog = buildAudioSourceLog(source, resolvedAudioUrl, playbackAudioUrl, usesObjectUrl)

    console.log('[媒体播放器] 播放音频:', currentAudioSourceLog)
    audioElement.src = playbackAudioUrl
    audioElement.volume = Math.max(0, Math.min(1, volume))
    audioElement.load()
    await waitForAudioReady(audioElement)
    await audioElement.play()

    // 发射音频开始事件，传递 audio 元素用于口型同步
    emit('audioStart', audioElement)
  } catch (error) {
    console.error('[媒体播放器] 音频播放失败:', {
      error: formatPlaybackError(error),
      source: currentAudioSourceLog || buildAudioSourceLog(source, resolvedAudioUrl, playbackAudioUrl, usesObjectUrl),
      element: describeAudioState(audioElement),
    })
    clearAudioElementSource(audioElement)
    if (isAudioActive) {
      isAudioActive = false
      emit('audioEnd')
    }
  }
}

/**
 * 停止音频
 */
function stopAudio() {
  const audioElement = audioRef.value
  if (!audioElement) return

  const shouldEmit = isAudioActive
  isAudioActive = false

  clearAudioElementSource(audioElement)
  if (shouldEmit) {
    emit('audioEnd')
  }
}

/**
 * 显示图片（支持 URL、RID、inline base64）
 */
function showImage(urlOrData: string, duration?: number) {
  const imageUrl = resolveResourceSource(
    isDirectResourceUrl(urlOrData)
      ? { url: urlOrData }
      : { rid: urlOrData },
    {
      resourceBaseUrl: connectionStore.resourceBaseUrl,
      resourcePath: connectionStore.resourcePath,
      resourceToken: connectionStore.resourceToken,
    }
  )

  if (!imageUrl) {
    console.warn('[媒体播放器] 图片资源地址不可用:', urlOrData)
    return
  }

  console.log('[媒体播放器] 显示图片:', imageUrl)
  currentImage.value = imageUrl

  if (imageHideTimer !== null) {
    clearTimeout(imageHideTimer)
    imageHideTimer = null
  }

  if (duration && duration > 0) {
    imageHideTimer = window.setTimeout(() => {
      hideImage()
    }, duration)
  }
}

/**
 * 隐藏图片
 */
function hideImage() {
  if (imageHideTimer !== null) {
    clearTimeout(imageHideTimer)
    imageHideTimer = null
  }
  currentImage.value = undefined
}

/**
 * 播放视频（支持 URL、RID）
 */
function playVideo(urlOrData: string) {
  const videoUrl = resolveResourceSource(
    isDirectResourceUrl(urlOrData)
      ? { url: urlOrData }
      : { rid: urlOrData },
    {
      resourceBaseUrl: connectionStore.resourceBaseUrl,
      resourcePath: connectionStore.resourcePath,
      resourceToken: connectionStore.resourceToken,
    }
  )

  if (!videoUrl) {
    console.warn('[媒体播放器] 视频资源地址不可用:', urlOrData)
    return
  }

  console.log('[媒体播放器] 播放视频:', videoUrl)
  currentVideo.value = videoUrl
}

/**
 * 隐藏视频
 */
function hideVideo() {
  if (videoRef.value) {
    videoRef.value.pause()
  }
  currentVideo.value = undefined
}

/**
 * 音频播放结束
 */
function handleAudioEnded() {
  console.log('[媒体播放器] 音频播放结束')
  isAudioActive = false
  revokeActiveAudioObjectUrl()
  currentAudioSourceLog = null
  emit('audioEnd')
}

function handleAudioError() {
  if (isResettingAudioElement) {
    return
  }
  console.error('[媒体播放器] 音频元素错误事件:', {
    source: currentAudioSourceLog,
    element: describeAudioState(audioRef.value),
  })
}

function handleAudioStalled() {
  if (isResettingAudioElement) {
    return
  }
  console.warn('[媒体播放器] 音频加载停滞:', {
    source: currentAudioSourceLog,
    element: describeAudioState(audioRef.value),
  })
}

function handleAudioAbort() {
  if (isResettingAudioElement) {
    return
  }
  console.warn('[媒体播放器] 音频加载中止:', {
    source: currentAudioSourceLog,
    element: describeAudioState(audioRef.value),
  })
}

/**
 * 视频播放结束
 */
function handleVideoEnded() {
  console.log('[媒体播放器] 视频播放结束')
  hideVideo()
}

// 暴露方法给父组件
defineExpose({
  playAudio,
  stopAudio,
  showImage,
  hideImage,
  playVideo,
  hideVideo
})

onBeforeUnmount(() => {
  stopAudio()
})
</script>

<style scoped lang="scss">
.media-player {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
}

audio {
  display: none;
}

.media-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(var(--color-accent-rgb), 0.18), transparent 36%),
    rgba(2, 6, 12, 0.95);
  pointer-events: all;
  cursor: pointer;
}

.media-card {
  width: min(960px, 100%);
  max-height: calc(100vh - 48px);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-radius: 28px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.18);
  background:
    linear-gradient(180deg, rgba(var(--color-accent-rgb), 0.14), transparent 18%),
    #0f1520;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  cursor: default;
}

.media-card--image {
  width: min(880px, 100%);
}

.media-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.media-card__title {
  color: var(--color-text-primary);
  font-size: 18px;
  line-height: 1.2;
}

.media-card__close {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--surface-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-secondary);
  transition: background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.14);
    border-color: rgba(var(--color-accent-rgb), 0.22);
    color: var(--color-text-primary);
  }
}

.image-overlay img {
  width: 100%;
  max-width: 100%;
  max-height: min(74vh, 880px);
  object-fit: contain;
  border-radius: 22px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.16);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.34);
  background: rgba(0, 0, 0, 0.18);
}

.video-overlay video {
  width: 100%;
  max-width: 100%;
  max-height: min(72vh, 860px);
  border-radius: 22px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.16);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.34);
  background: rgba(0, 0, 0, 0.18);
}

.media-card__hint {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  text-align: right;
}

@media (max-width: 720px) {
  .media-overlay {
    padding: 12px;
  }

  .media-card {
    padding: 14px;
    border-radius: 22px;
  }

  .media-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .media-card__hint {
    text-align: left;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-norm) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
