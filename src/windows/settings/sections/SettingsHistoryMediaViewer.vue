<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="visible && src" class="history-media-viewer-overlay" @click="closeViewer">
        <button class="close-btn" @click="closeViewer">
          <X :size="24" />
        </button>
        <div class="media-container" @click.stop>
          <img v-if="type === 'image'" :src="src" alt="历史消息图片放大预览" />
          <video v-else-if="type === 'video'" :src="src" controls autoplay playsinline></video>
        </div>
        <div class="hint-text">按 ESC 键或点击空白区域关闭</div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  type: 'image' | 'video' | null
  src: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

function closeViewer() {
  emit('update:visible', false)
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    closeViewer()
  }
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }
)

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.history-media-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  backdrop-filter: blur(4px);
}

.close-btn {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 2;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.media-container {
  width: 100%;
  height: 100%;
  padding: 60px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  box-sizing: border-box;
}

.media-container img,
.media-container video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.hint-text {
  position: absolute;
  bottom: 24px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
