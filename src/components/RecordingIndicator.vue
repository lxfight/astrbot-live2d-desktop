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
  gap: 14px;
  padding: 18px 28px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.85) 100%);
  backdrop-filter: blur(20px);
  border-radius: 28px;
  color: #fff;
  box-shadow: 
    0 12px 32px rgba(239, 68, 68, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.2);
  animation: slideDown 0.4s ease-out, breathe 2s ease-in-out infinite;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes breathe {
  0%, 100% {
    transform: translateX(-50%) scale(1);
    box-shadow: 
      0 12px 32px rgba(239, 68, 68, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.2);
  }
  50% {
    transform: translateX(-50%) scale(1.02);
    box-shadow: 
      0 16px 40px rgba(239, 68, 68, 0.4),
      0 6px 16px rgba(0, 0, 0, 0.25);
  }
}

.microphone-icon {
  width: 28px;
  height: 28px;
  color: rgba(255, 255, 255, 0.95);
  animation: iconGlow 1.5s ease-in-out infinite;
  filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.6));
}

@keyframes iconGlow {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.6));
  }
  50% {
    transform: scale(1.15);
    filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.8));
  }
}

.recording-text {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.6px;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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
