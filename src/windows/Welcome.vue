<template>
  <div class="welcome-screen window-drag-region" :style="welcomeThemeStyle">
    <!-- Starry background with more stars -->
    <div class="welcome-screen__backdrop" aria-hidden="true">
      <div class="stars-container">
        <Sparkles v-for="i in 36" :key="i" class="sparkle" :style="sparkleStyle(i)" />
      </div>
    </div>

    <!-- The "Slime" Background Blob -->
    <div class="background-blob-container" aria-hidden="true">
      <div class="background-blob"></div>
    </div>

    <transition name="fade">
      <button
        class="welcome-close window-no-drag"
        type="button"
        aria-label="关闭"
        @click="handleClose"
      >
        <X :size="15" />
      </button>
    </transition>

    <main class="welcome-stage">
      <transition name="welcome-scene" mode="out-in">
        <section v-if="stage === 'intro'" key="intro" class="welcome-scene welcome-scene--intro">
          <div class="mascot-container" aria-hidden="true">
            <div class="mascot-blob window-no-drag">
              <div class="mascot-eyes" :class="{ 'is-winking': isWinking, 'is-blinking': isBlinkingSync }">
                <div class="eye-socket left" :style="eyeMovementStyle">
                  <div class="eye">
                    <div class="pupil"></div>
                  </div>
                </div>
                <div class="eye-socket right" :style="eyeMovementStyle">
                  <div class="eye">
                    <div class="pupil"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mascot-shadow"></div>
          </div>

          <div class="greeting-box">
            <h1 class="welcome-greeting">初次见面，请多关照～</h1>
            <p class="welcome-subtitle">我将作为你的专属桌宠，长伴你左右...</p>
          </div>
        </section>

        <section v-else key="form" class="welcome-scene welcome-scene--form">
          <div class="organic-content window-no-drag">
            <div class="form-mascot-container" aria-hidden="true">
              <div class="mascot-blob mascot-blob--large">
                <div class="mascot-eyes mascot-eyes--large" :class="{ 'is-winking': isWinking, 'is-blinking': isBlinkingSync }">
                  <div class="eye-socket left" :style="eyeMovementStyle">
                    <div class="eye">
                      <div class="pupil"></div>
                    </div>
                  </div>
                  <div class="eye-socket right" :style="eyeMovementStyle">
                    <div class="eye">
                      <div class="pupil"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mascot-shadow"></div>
            </div>

            <div class="welcome-form-header">
              <h2>该怎么称呼你呢？</h2>
              <p>告诉我你的昵称，开启旅程 ✦</p>
            </div>

            <div class="welcome-input-area">
              <div class="input-wrapper">
                <input
                  id="welcome-name-input"
                  ref="nameInput"
                  v-model="userName"
                  type="text"
                  class="welcome-input"
                  placeholder="在此输入昵称..."
                  maxlength="20"
                  autocomplete="nickname"
                  @keyup.enter="handleSubmit"
                />
                <div class="input-underline"></div>
                <Heart v-if="userName.trim().length > 0" class="input-icon-active" :size="22" />
              </div>
            </div>

            <button
              class="welcome-submit"
              type="button"
              :class="{ 'is-loading': isSubmitting }"
              :disabled="!userName.trim() || isSubmitting"
              @click="handleSubmit"
            >
              <span class="submit-text" v-if="!isSubmitting">开始我们的旅程</span>
              <span class="submit-text" v-else>正在为你准备小窝...</span>
            </button>

            <transition name="fade">
              <p v-if="submitError" class="welcome-error" role="alert" aria-live="assertive">
                {{ submitError }}
              </p>
            </transition>

            <span class="welcome-hint">按下 Enter 键也可以继续哦</span>
          </div>
        </section>
      </transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { X, Sparkles, Heart } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { palette } = storeToRefs(themeStore)

const stage = ref<'intro' | 'form'>('intro')
const userName = ref('')
const isSubmitting = ref(false)
const submitError = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

// 眼睛自动交互逻辑
const lookX = ref(0)
const lookY = ref(0)
const isWinking = ref(false)
const isBlinkingSync = ref(false)

const eyeMovementStyle = computed(() => {
  return {
    transform: `translate(${lookX.value}px, ${lookY.value}px)`
  }
})

const triggerBlink = () => {
  if (isBlinkingSync.value || isWinking.value) return
  isBlinkingSync.value = true
  setTimeout(() => {
    isBlinkingSync.value = false
  }, 150) // 快速眨眼
}

const triggerWink = () => {
  if (isWinking.value) return
  isWinking.value = true
  setTimeout(() => {
    isWinking.value = false
  }, 1200)
}

const autoLookAround = () => {
  const strength = 12
  lookX.value = (Math.random() - 0.5) * 2 * strength
  lookY.value = (Math.random() - 0.5) * 2 * strength
  
  const rand = Math.random()
  if (rand > 0.8) triggerWink()
  else if (rand > 0.4) triggerBlink()
}

function sparkleStyle(i: number) {
  // Use more varied constants for true pseudo-random distribution
  const x = Math.sin(i * 12.9898 + 4.123) * 43758.5453
  const y = Math.cos(i * 78.233 + 7.891) * 43758.5453
  const left = (x - Math.floor(x)) * 100
  const top = (y - Math.floor(y)) * 100
  
  const size = 3 + (i % 12)
  const delay = (i * 0.44) % 6
  const duration = 4 + (i % 6)
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    opacity: 0.1 + (i % 10) / 15
  }
}

const welcomeThemeStyle = computed(() => ({
  '--welcome-accent': palette.value.accent,
  '--welcome-accent-soft': palette.value.accentSoft,
  '--welcome-accent-rgb': palette.value.accentRgb || '116, 165, 255',
  '--welcome-chart-1': palette.value.chartPalette[1],
}))

watch(userName, () => {
  if (submitError.value) submitError.value = ''
})

let lookTimer: number | null = null
let introTimer: number | null = null
let focusTimer: number | null = null

onMounted(() => {
  themeStore.syncFromStorage()
  themeStore.startStorageSync()
  
  // 定时自动张望
  lookTimer = window.setInterval(autoLookAround, 2500)

  introTimer = window.setTimeout(() => {
    stage.value = 'form'
    focusTimer = window.setTimeout(() => {
      nextTick(() => nameInput.value?.focus())
    }, 600)
  }, 2800)
})

onBeforeUnmount(() => {
  themeStore.stopStorageSync()
  if (lookTimer !== null) clearInterval(lookTimer)
  if (introTimer !== null) clearTimeout(introTimer)
  if (focusTimer !== null) clearTimeout(focusTimer)
})

async function handleSubmit() {
  const name = userName.value.trim()
  if (!name || isSubmitting.value) return

  submitError.value = ''
  isSubmitting.value = true

  try {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await window.electron.user.setUserName(name)
  } catch (error) {
    console.error('[Welcome] 设置用户名称失败:', error)
    submitError.value = '呜呜，设置失败了，请稍后再试～'
    isSubmitting.value = false
  }
}

function handleClose() {
  window.electron.window.closeWelcome()
}
</script>

<style scoped lang="scss">
.welcome-screen {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: transparent !important;
  color: #fff;
  font-family: var(--font-fallback, system-ui, sans-serif);
}

/* Starry background */
.welcome-screen__backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.stars-container {
  position: absolute;
  inset: 0;
}

.sparkle {
  position: absolute;
  color: #fff;
  animation: twinkle linear infinite;
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.4));
}

@keyframes twinkle {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { transform: scale(1) rotate(90deg); opacity: 0.8; }
  100% { transform: scale(0) rotate(180deg); opacity: 0; }
}

/* Slime Background Blob - Replaces the circular glow */
.background-blob-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 0;
  /* Apply mask to ensure outer edges are soft */
  mask-image: radial-gradient(circle, black 50%, transparent 95%);
  -webkit-mask-image: radial-gradient(circle, black 50%, transparent 95%);
}

.background-blob {
  width: 580px;
  height: 520px;
  background: rgba(var(--welcome-accent-rgb), 0.16);
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
  backdrop-filter: blur(40px);
  box-shadow: 
    0 0 80px rgba(var(--welcome-accent-rgb), 0.1),
    inset 0 0 40px rgba(255, 255, 255, 0.05);
  animation: blob-float-bg 20s infinite alternate linear;
}

@keyframes blob-float-bg {
  0% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; transform: rotate(0deg) scale(1); }
  33% { border-radius: 60% 40% 30% 70% / 50% 40% 50% 60%; transform: rotate(5deg) scale(1.05); }
  66% { border-radius: 30% 70% 60% 40% / 60% 50% 40% 50%; transform: rotate(-5deg) scale(0.95); }
  100% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; transform: rotate(0deg) scale(1); }
}

.welcome-close {
  position: absolute;
  top: 15%;
  right: 15%;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.4s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    transform: rotate(90deg);
  }
}

.welcome-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.welcome-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
}

.welcome-scene--intro {
  gap: 36px;
  animation: fade-in-scale 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.organic-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 440px;
  padding: 0;
  background: transparent !important;
}

.mascot-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.mascot-blob {
  width: 120px;
  height: 110px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.1));
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 45% 55% 40% 60% / 55% 45% 60% 40%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(12px);
  animation: blob-bounce 3.5s ease-in-out infinite alternate, blob-morph 7s linear infinite;
  box-shadow: 0 10px 40px rgba(var(--welcome-accent-rgb), 0.2);
  position: relative;
  overflow: hidden;

  &--large {
    width: 150px;
    height: 135px;
  }
}

.mascot-eyes {
  display: flex;
  gap: 20px;
  
  .eye-socket {
    position: relative;
    transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .eye {
    width: 18px;
    height: 24px;
    background: #111;
    border-radius: 50%;
    position: relative;
    transition: transform 0.1s ease-out, background 0.3s ease;
    
    .pupil {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 5px;
      height: 5px;
      background: #fff;
      border-radius: 50%;
      opacity: 0.8;
    }
  }

  &.is-blinking:not(.is-winking) {
    .eye {
      transform: scaleY(0.1);
    }
  }

  &.is-winking {
    .eye-socket.left .eye {
      transform: scaleY(1);
    }
    
    .eye-socket.right .eye {
      background: transparent !important;
      width: 20px;
      height: 20px;
      border-radius: 0;
      transform: scaleY(1);
      
      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 12px;
        height: 12px;
        border-right: 3.5px solid #111;
        border-bottom: 3.5px solid #111;
        transform: translate(-30%, -30%) rotate(135deg);
      }
      
      .pupil { display: none; }
    }
  }

  &--large {
    gap: 28px;
    .eye {
      width: 22px;
      height: 30px;
      .pupil {
        width: 7px;
        height: 7px;
      }
    }
  }
}

.mascot-shadow {
  width: 70px;
  height: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  filter: blur(5px);
  margin-top: 12px;
  animation: shadow-pulse 3.5s ease-in-out infinite alternate;
}

@keyframes blob-bounce {
  0% { transform: translateY(-4px); }
  100% { transform: translateY(14px); }
}

@keyframes shadow-pulse {
  0% { transform: scale(1); opacity: 0.2; }
  100% { transform: scale(0.6); opacity: 0.05; }
}

.welcome-greeting {
  font-size: clamp(28px, 6vw, 36px);
  font-weight: 800;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #ffffff, #ffe3f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.5));
}

.welcome-subtitle {
  color: rgba(255, 255, 255, 1);
  font-size: 17px;
  font-weight: 500;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

/* Form Styling */
.welcome-form-header {
  margin-bottom: 36px;
  h2 { 
    font-size: 28px; 
    font-weight: 800; 
    margin-bottom: 12px; 
    color: #fff;
    text-shadow: 0 2px 15px rgba(0, 0, 0, 0.6);
  }
  p { 
    color: rgba(255, 255, 255, 0.95); 
    font-size: 15px; 
    font-weight: 500;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  }
}

.welcome-input-area {
  width: 320px;
  margin-bottom: 44px;
}

.welcome-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  padding: 14px 20px;
  color: #fff;
  font-size: 22px;
  text-align: center;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.2);

  &::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  &:focus { 
    outline: none; 
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(var(--welcome-accent-rgb), 0.6);
    box-shadow: 0 0 15px rgba(var(--welcome-accent-rgb), 0.2), inset 0 2px 10px rgba(0, 0, 0, 0.3);
  }
}

.input-underline {
  display: none; /* Replaced by full border input */
}

.input-icon-active {
  position: absolute;
  top: -28px;
  right: 15px;
  color: #ffb6c1;
  filter: drop-shadow(0 0 8px rgba(255, 182, 193, 1));
  animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.welcome-submit {
  width: 100%;
  height: 56px;
  border-radius: 28px;
  /* 换用更柔和和谐的渐变色，去除边框 */
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(240, 245, 255, 0.8));
  border: none;
  color: #4a5b7d;
  font-size: 16px;
  font-weight: 800;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
  text-transform: uppercase;
  letter-spacing: 1px;
  backdrop-filter: blur(4px);

  &:hover:not(:disabled) {
    transform: translateY(-5px) scale(1.03);
    box-shadow: 0 15px 35px rgba(255, 255, 255, 0.2);
    background: #fff;
    color: var(--welcome-accent, #74a5ff);
  }

  &:active:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled { 
    opacity: 0.2; 
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.3);
    box-shadow: none;
    cursor: not-allowed; 
  }
}

.welcome-error { 
  color: #ff9999; 
  font-size: 14px; 
  font-weight: 600;
  margin-bottom: 20px; 
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
.welcome-hint { 
  color: rgba(255, 255, 255, 0.5); 
  font-size: 13px; 
  text-shadow: 0 1px 4px rgba(0, 0, 0, 1);
}

/* Transitions */
.welcome-scene-enter-active { transition: all 1s cubic-bezier(0.34, 1.56, 0.64, 1); }
.welcome-scene-leave-active { transition: all 0.5s ease-in; }
.welcome-scene-enter-from { opacity: 0; transform: scale(0.9) translateY(40px); filter: blur(20px); }
.welcome-scene-leave-to { opacity: 0; transform: scale(1.1) translateY(-40px); filter: blur(20px); }

@keyframes fade-in-scale { 
  from { opacity: 0; transform: scale(0.8) translateY(50px); filter: blur(20px); } 
  to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } 
}
@keyframes blob-morph {
  0%, 100% { border-radius: 45% 55% 40% 60% / 55% 45% 60% 40%; }
  33% { border-radius: 55% 45% 60% 40% / 45% 55% 40% 60%; }
  66% { border-radius: 40% 60% 55% 45% / 60% 40% 45% 55%; }
}
</style>
