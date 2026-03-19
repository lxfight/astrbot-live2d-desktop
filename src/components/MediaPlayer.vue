<template>
  <div class="media-player">
    <!-- 音频播放器 -->
    <audio ref="audioRef" @ended="handleAudioEnded" />

    <!-- 图片显示 -->
    <transition name="fade">
      <div v-if="currentImage" class="media-overlay image-overlay" @click="hideImage">
        <div class="media-card media-card--image" @click.stop>
          <div class="media-card__header">
            <strong class="media-card__title">当前图片内容</strong>
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
            <strong class="media-card__title">当前视频内容</strong>
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
import { ref } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { resolveResourceSource } from '@/utils/resourceUrl'

const audioRef = ref<HTMLAudioElement>()
const videoRef = ref<HTMLVideoElement>()
const currentImage = ref<string>()
const currentVideo = ref<string>()
const connectionStore = useConnectionStore()

let isAudioActive = false
let imageHideTimer: number | null = null

// 定义 emit
const emit = defineEmits<{
  audioStart: [audioElement: HTMLAudioElement]
  audioEnd: []
}>()

/**
 * 播放音频（支持 URL、RID、inline base64）
 */
async function playAudio(urlOrData: string, volume: number = 1.0) {
  if (!audioRef.value) return

  try {
    stopAudio()

    isAudioActive = true
    const audioUrl = resolveResourceSource(
      urlOrData.startsWith('http://') || urlOrData.startsWith('https://') || urlOrData.startsWith('data:')
        ? { url: urlOrData }
        : { rid: urlOrData },
      {
        resourceBaseUrl: connectionStore.resourceBaseUrl,
        resourcePath: connectionStore.resourcePath,
        resourceToken: connectionStore.resourceToken,
      }
    )

    if (!audioUrl) {
      throw new Error('音频资源地址不可用')
    }

    console.log('[媒体播放器] 播放音频:', audioUrl)
    audioRef.value.src = audioUrl
    audioRef.value.volume = Math.max(0, Math.min(1, volume))
    await audioRef.value.play()

    // 发射音频开始事件，传递 audio 元素用于口型同步
    emit('audioStart', audioRef.value)
  } catch (error) {
    console.error('[媒体播放器] 音频播放失败:', error)
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
  if (!audioRef.value) return

  const shouldEmit = isAudioActive
  isAudioActive = false

  audioRef.value.pause()
  audioRef.value.currentTime = 0
  if (shouldEmit) {
    emit('audioEnd')
  }
}

/**
 * 显示图片（支持 URL、RID、inline base64）
 */
function showImage(urlOrData: string, duration?: number) {
  const imageUrl = resolveResourceSource(
    urlOrData.startsWith('http://') || urlOrData.startsWith('https://') || urlOrData.startsWith('data:')
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
    urlOrData.startsWith('http://') || urlOrData.startsWith('https://') || urlOrData.startsWith('data:')
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
  emit('audioEnd')
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
