<template>
  <Transition name="fade">
    <div v-if="isRecording" class="recording-indicator">
      <div class="indicator-content">
        <svg class="microphone-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="currentColor"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor"/>
        </svg>
        <div class="recording-text">正在聆听...</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  isRecording: boolean
}

defineProps<Props>()
</script>

<style scoped>
.recording-indicator {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
}

.indicator-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  color: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: pulse 2s ease-in-out infinite;
}

.microphone-icon {
  width: 24px;
  height: 24px;
  color: #ff4757;
  animation: iconPulse 1.5s ease-in-out infinite;
}

.recording-text {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.95;
  }
  50% {
    transform: scale(1.02);
    opacity: 1;
  }
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}
</style>
