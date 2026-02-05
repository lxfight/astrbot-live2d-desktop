<template>
  <div class="welcome-screen">
    <!-- Drag Region -->
    <div class="drag-region"></div>

    <!-- Window Controls -->
    <div class="window-controls">
      <button class="close-btn" @click="handleClose">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <!-- Content -->
    <div class="content-container">
      <transition name="fade-slide" mode="out-in">

        <!-- Phase 1: Intro Animation -->
        <div v-if="stage === 'intro'" class="intro-phase" key="intro">
          <div class="logo-wrapper">
            <div class="energy-ring"></div>
            <div class="energy-core"></div>
          </div>
          <h1 class="intro-text">ASTRBOT</h1>
        </div>

        <!-- Phase 2: Input Form -->
        <div v-else-if="stage === 'form'" class="form-phase" key="form">
          <h2 class="prompt-text">初次见面，如何称呼您？</h2>

          <div class="input-wrapper">
            <input
              v-model="userName"
              type="text"
              class="hero-input"
              placeholder="请输入您的昵称"
              maxlength="20"
              @keyup.enter="handleSubmit"
              ref="nameInput"
            />
            <div class="input-underline"></div>
          </div>

          <div class="action-area" :class="{ visible: userName.trim() }">
             <button class="enter-btn" @click="handleSubmit">
               <span v-if="!isSubmitting">你好</span>
               <span v-else class="dots">...</span>
             </button>
             <div class="enter-hint">按 Enter 键继续</div>
          </div>
        </div>

      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const stage = ref('intro') // intro | form
const userName = ref('')
const isSubmitting = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  // Play Intro Animation
  setTimeout(() => {
    stage.value = 'form'
    setTimeout(() => {
      nextTick(() => nameInput.value?.focus())
    }, 300)
  }, 2200)
})

async function handleSubmit() {
  const name = userName.value.trim()
  if (!name || isSubmitting.value) return

  isSubmitting.value = true

  // Simulate processing
  setTimeout(async () => {
    try {
      await window.electron.user.setUserName(name)
    } catch (error) {
      console.error('Error:', error)
      isSubmitting.value = false
    }
  }, 1000)
}

function handleClose() {
  window.electron.window.closeWelcome()
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;800&display=swap');

:global(body) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow: hidden;
}

.welcome-screen {
  width: 100vw;
  height: 100vh;
  position: relative;
  font-family: 'Exo 2', sans-serif;
  overflow: hidden;
  /* NO BACKGROUND - Pure Transparency */
}

/* Drag Region */
.drag-region {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  -webkit-app-region: drag;
}

/* Controls */
.window-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 50;
}

.close-btn {
  background: rgba(0, 0, 0, 0.3); /* Slight dim for visibility */
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  color: #fff;
  cursor: pointer;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}

.close-btn:hover {
  background: #ff4d4f;
  border-color: #ff4d4f;
  transform: rotate(90deg);
}

/* Content */
.content-container {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; /* Let clicks pass through empty space if needed, but we have drag region */
}

.intro-phase, .form-phase {
  pointer-events: auto; /* Re-enable for content */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* --- Intro Phase --- */
.logo-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
}

.energy-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: #00f2ff;
  border-radius: 50%;
  box-shadow: 0 0 40px #00f2ff;
  animation: core-pulse 2s infinite;
}

.energy-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 4px solid rgba(0, 242, 255, 0.3);
  border-top-color: #00f2ff;
  border-radius: 50%;
  animation: ring-spin 1.5s linear infinite;
}

.intro-text {
  font-size: 4rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.2em;
  text-shadow:
    0 0 10px rgba(0, 242, 255, 0.8),
    0 0 20px rgba(0, 242, 255, 0.4),
    2px 2px 0px rgba(0,0,0,0.5); /* Hard shadow for contrast */
  margin: 0;
  animation: text-flicker 3s infinite;
}

/* --- Form Phase --- */
.prompt-text {
  font-size: 2rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2.5rem;
  text-shadow:
    0 2px 4px rgba(0,0,0,0.9),
    0 0 15px rgba(0,0,0,0.5);
  letter-spacing: 1px;
}

.input-wrapper {
  position: relative;
  width: 320px;
  margin-bottom: 1.5rem;
}

.hero-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.4); /* Slight dark backing for readability */
  border: none;
  border-radius: 8px;
  padding: 15px 20px;
  font-size: 1.5rem;
  color: #00f2ff;
  text-align: center;
  font-weight: 600;
  font-family: inherit;
  outline: none;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  transition: all 0.3s;
  -webkit-app-region: no-drag;
}

.hero-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 400;
}

.hero-input:focus {
  background: rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 25px rgba(0, 242, 255, 0.3);
}

.input-underline {
  height: 3px;
  width: 0%;
  background: #00f2ff;
  margin: 0 auto;
  transition: width 0.4s ease;
  box-shadow: 0 0 10px #00f2ff;
  margin-top: 5px;
}

.hero-input:focus + .input-underline {
  width: 100%;
}

.action-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.4s;
}

.action-area.visible {
  opacity: 1;
  transform: translateY(0);
}

.enter-btn {
  background: linear-gradient(135deg, #00f2ff, #00a8ff);
  border: none;
  padding: 10px 40px;
  border-radius: 30px;
  color: #000;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 0 20px rgba(0, 242, 255, 0.4);
  margin-bottom: 8px;
  -webkit-app-region: no-drag;
  transition: transform 0.2s;
}

.enter-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(0, 242, 255, 0.6);
}

.enter-hint {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

/* Animations */
@keyframes ring-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes core-pulse { 0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; } 50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; } }
@keyframes text-flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; text-shadow: 0 0 15px rgba(0, 242, 255, 0.9); } }

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: scale(1.1) translateY(-20px);
  filter: blur(8px);
}
</style>
