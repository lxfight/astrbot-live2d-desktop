<template>
  <div class="media-player">
    <!-- 音频播放器 -->
    <audio ref="audioRef" @ended="handleAudioEnded" />

    <!-- 图片显示 -->
    <transition name="fade">
      <div v-if="currentImage" class="image-overlay" @click="hideImage">
        <img :src="currentImage" alt="Performance Image" />
      </div>
    </transition>

    <!-- 视频播放器 -->
    <transition name="fade">
      <div v-if="currentVideo" class="video-overlay" @click="hideVideo">
        <video
          ref="videoRef"
          :src="currentVideo"
          autoplay
          controls
          @ended="handleVideoEnded"
        />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const audioRef = ref<HTMLAudioElement>()
const videoRef = ref<HTMLVideoElement>()
const currentImage = ref<string>()
const currentVideo = ref<string>()

/**
 * 播放音频（支持 URL、RID、inline base64）
 */
async function playAudio(urlOrData: string, volume: number = 1.0) {
  if (!audioRef.value) return

  try {
    let audioUrl = urlOrData

    // 处理 inline base64
    if (urlOrData.startsWith('data:')) {
      audioUrl = urlOrData
    }
    // 处理 RID（需要从资源服务器获取）
    else if (!urlOrData.startsWith('http://') && !urlOrData.startsWith('https://')) {
      // 假设是 RID，从配置的资源服务器获取
      const resourceBaseUrl = (window as any).resourceBaseUrl || 'http://localhost:9091'
      audioUrl = `${resourceBaseUrl}/resources/${urlOrData}`
    }

    console.log('[媒体播放器] 播放音频:', audioUrl)
    audioRef.value.src = audioUrl
    audioRef.value.volume = Math.max(0, Math.min(1, volume))
    await audioRef.value.play()
  } catch (error) {
    console.error('[媒体播放器] 音频播放失败:', error)
  }
}

/**
 * 停止音频
 */
function stopAudio() {
  if (!audioRef.value) return
  audioRef.value.pause()
  audioRef.value.currentTime = 0
}

/**
 * 显示图片（支持 URL、RID、inline base64）
 */
function showImage(urlOrData: string, duration?: number) {
  let imageUrl = urlOrData

  // 处理 inline base64
  if (urlOrData.startsWith('data:')) {
    imageUrl = urlOrData
  }
  // 处理 RID
  else if (!urlOrData.startsWith('http://') && !urlOrData.startsWith('https://')) {
    const resourceBaseUrl = (window as any).resourceBaseUrl || 'http://localhost:9091'
    imageUrl = `${resourceBaseUrl}/resources/${urlOrData}`
  }

  console.log('[媒体播放器] 显示图片:', imageUrl)
  currentImage.value = imageUrl

  if (duration) {
    setTimeout(() => {
      hideImage()
    }, duration)
  }
}

/**
 * 隐藏图片
 */
function hideImage() {
  currentImage.value = undefined
}

/**
 * 播放视频（支持 URL、RID）
 */
function playVideo(urlOrData: string) {
  let videoUrl = urlOrData

  // 处理 RID
  if (!urlOrData.startsWith('http://') && !urlOrData.startsWith('https://') && !urlOrData.startsWith('data:')) {
    const resourceBaseUrl = (window as any).resourceBaseUrl || 'http://localhost:9091'
    videoUrl = `${resourceBaseUrl}/resources/${urlOrData}`
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

.image-overlay,
.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  pointer-events: all;
  cursor: pointer;
}

.image-overlay img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
}

.video-overlay video {
  max-width: 90%;
  max-height: 90%;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
