<template>
  <div class="welcome-screen window-drag-region" :style="welcomeThemeStyle">
    <!-- Soft dynamic background -->
    <div class="welcome-screen__backdrop" aria-hidden="true">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="stars-container">
        <Sparkles v-for="i in 8" :key="i" class="sparkle" :style="sparkleStyle(i)" />
      </div>
    </div>

    <button
      class="welcome-close window-no-drag"
      type="button"
      aria-label="关闭"
      @click="handleClose"
    >
      <X :size="15" />
    </button>

    <main class="welcome-stage">
      <transition name="welcome-scene" mode="out-in">
        <section v-if="stage === 'intro'" key="intro" class="welcome-scene welcome-scene--intro">
          <div class="mascot-container" aria-hidden="true">
            <div class="mascot-blob window-no-drag">
              <span class="mascot-face">(´• ω •`)ﾉ</span>
            </div>
            <div class="mascot-shadow"></div>
          </div>

          <div class="greeting-box">
            <h1 class="welcome-greeting">初次见面，请多关照～</h1>
            <p class="welcome-subtitle">我将作为你的专属桌宠，长伴你左右...</p>
          </div>
        </section>

        <section v-else key="form" class="welcome-scene welcome-scene--form">
          <div class="welcome-form-card window-no-drag">
            <div class="form-mascot-container" aria-hidden="true">
              <div class="mascot-blob mascot-blob--small">
                <span class="mascot-face">{{ faceExpression }}</span>
              </div>
            </div>

            <div class="welcome-form-card__header">
              <h2>该怎么称呼你呢？</h2>
              <p>告诉我你的名字，让我们建立起更深的联系吧 ✦</p>
            </div>

            <label class="welcome-field" for="welcome-name-input">
              <div class="input-wrapper">
                <input
                  id="welcome-name-input"
                  ref="nameInput"
                  v-model="userName"
                  type="text"
                  class="welcome-input"
                  placeholder="请输入你喜欢的昵称..."
                  maxlength="20"
                  autocomplete="nickname"
                  @keyup.enter="handleSubmit"
                />
                <Heart v-if="userName.trim().length > 0" class="input-icon-active" :size="18" />
              </div>
            </label>

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

let introTimer: number | null = null
let focusTimer: number | null = null

const welcomeThemeStyle = computed(() => ({
  '--welcome-accent': palette.value.accent,
  '--welcome-accent-soft': palette.value.accentSoft,
  '--welcome-shadow': palette.value.shadowColor,
  '--welcome-chart-1': palette.value.chartPalette[1],
  '--welcome-chart-2': palette.value.chartPalette[2],
  '--welcome-chart-3': palette.value.chartPalette[3],
}))

const faceExpression = computed(() => {
  if (isSubmitting.value) return '(๑•̀ㅂ•́)و✧'
  const len = userName.value.trim().length
  if (len > 4) return '(*≧ω≦)'
  if (len > 0) return '(｡♥‿♥｡)'
  return '(*・ω・)ﾏｽｩ'
})

function sparkleStyle(i: number) {
  const seed = i * 137.508
  const left = (seed * 7.3) % 100
  const top = (seed * 11.7) % 100
  const size = 10 + (seed % 14)
  const delay = (seed % 5).toFixed(1)
  const duration = 3 + (seed % 5)
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
  }
}

watch(userName, () => {
  if (submitError.value) submitError.value = ''
})

onMounted(() => {
  themeStore.syncFromStorage()
  themeStore.startStorageSync()

  introTimer = window.setTimeout(() => {
    stage.value = 'form'
    focusTimer = window.setTimeout(() => {
      nextTick(() => nameInput.value?.focus())
    }, 500)
  }, 2800)
})

onBeforeUnmount(() => {
  themeStore.stopStorageSync()
  if (introTimer !== null) clearTimeout(introTimer)
  if (focusTimer !== null) clearTimeout(focusTimer)
})

async function handleSubmit() {
  const name = userName.value.trim()
  if (!name || isSubmitting.value) return

  submitError.value = ''
  isSubmitting.value = true

  try {
    // 增加一点动画延时让用户看到可爱的提交表情
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
  background: transparent;
  color: #fff;
  font-family: var(--font-fallback, system-ui, sans-serif);
}

.welcome-screen__backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  background: 
    radial-gradient(circle at 15% 30%, rgba(var(--color-accent-rgb, 116, 165, 255), 0.12), transparent 45%),
    radial-gradient(circle at 85% 20%, rgba(255, 182, 193, 0.12), transparent 40%),
    radial-gradient(circle at 50% 80%, rgba(147, 112, 219, 0.12), transparent 50%);
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.6;
  animation: float 12s ease-in-out infinite alternate;
}

.orb-1 {
  top: -10%; left: -10%; width: 55vw; height: 55vw;
  background: rgba(var(--color-accent-rgb, 116, 165, 255), 0.2);
  animation-delay: -2s;
}

.orb-2 {
  bottom: -20%; right: -10%; width: 65vw; height: 65vw;
  background: rgba(255, 192, 203, 0.18); /* soft pink */
  animation-delay: -5s;
}

.orb-3 {
  top: 40%; left: 60%; width: 45vw; height: 45vw;
  background: rgba(147, 112, 219, 0.15); /* soft purple */
  animation-delay: -7s;
}

.stars-container {
  position: absolute;
  inset: 0;
}

.sparkle {
  position: absolute;
  color: #fff;
  opacity: 0;
  animation: twinkle linear infinite;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.8));
}

@keyframes twinkle {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { transform: scale(1) rotate(180deg); opacity: 0.7; }
  100% { transform: scale(0) rotate(360deg); opacity: 0; }
}

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, 30px) scale(1.05); }
  100% { transform: translate(-30px, 50px) scale(0.95); }
}

.welcome-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    transform: rotate(90deg) scale(1.1);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.3);
  }
}

.welcome-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  padding: 24px;
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
}

/* Mascot Display */
.mascot-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  
  &:hover .mascot-blob {
    animation: blob-bounce-hover 1s ease-in-out infinite alternate, blob-morph 3s linear infinite;
    transform: scale(1.05);
    box-shadow: 
      0 12px 42px rgba(255, 182, 193, 0.3),
      inset 0 4px 18px rgba(255, 255, 255, 0.6);
  }
}

.mascot-blob {
  width: 120px;
  height: 110px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.05));
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 
    0 8px 32px rgba(255, 182, 193, 0.2),
    inset 0 4px 18px rgba(255, 255, 255, 0.4);
  border-radius: 45% 55% 40% 60% / 55% 45% 60% 40%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(14px);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: blob-bounce 3s ease-in-out infinite alternate, blob-morph 6s linear infinite;

  &--small {
    width: 90px;
    height: 80px;
    animation: blob-bounce-small 2.5s ease-in-out infinite alternate, blob-morph 5s linear infinite;
  }
}

.mascot-face {
  font-size: 26px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  letter-spacing: 1px;

  .mascot-blob--small & {
    font-size: 19px;
  }
}

.mascot-shadow {
  width: 64px;
  height: 8px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 50%;
  filter: blur(5px);
  animation: shadow-pulse 3s ease-in-out infinite alternate;
}

@keyframes blob-bounce {
  0% { transform: translateY(-6px); }
  100% { transform: translateY(12px); }
}

@keyframes blob-bounce-small {
  0% { transform: translateY(-4px); }
  100% { transform: translateY(8px); }
}

@keyframes blob-bounce-hover {
  0% { transform: translateY(-10px) scale(1.05); }
  100% { transform: translateY(5px) scale(1.05); }
}

@keyframes blob-morph {
  0%, 100% { border-radius: 45% 55% 40% 60% / 55% 45% 60% 40%; }
  33% { border-radius: 55% 45% 60% 40% / 45% 55% 40% 60%; }
  66% { border-radius: 40% 60% 55% 45% / 60% 40% 45% 55%; }
}

@keyframes shadow-pulse {
  0% { transform: scale(1); opacity: 0.25; }
  100% { transform: scale(0.7); opacity: 0.1; }
}

.greeting-box {
  animation: fade-up 1s ease-out;
}

.welcome-greeting {
  font-size: clamp(26px, 4.5vw, 34px);
  font-weight: 700;
  margin-bottom: 14px;
  background: linear-gradient(135deg, #ffffff, #ffe0f5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 4px 16px rgba(255, 182, 193, 0.3);
  letter-spacing: 0.5px;
}

.welcome-subtitle {
  color: rgba(255, 255, 255, 0.75);
  font-size: 16px;
  letter-spacing: 0.5px;
}

/* Form Scene */
.welcome-scene--form {
  max-width: 460px;
  perspective: 1000px;
}

.welcome-form-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 36px;
  padding: 44px 36px 36px;
  box-shadow: 
    0 24px 54px rgba(0, 0, 0, 0.25),
    inset 0 1px 2px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(24px);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 120px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent);
    pointer-events: none;
  }
}

.form-mascot-container {
  margin-bottom: 28px;
  cursor: default;
}

.welcome-form-card__header {
  text-align: center;
  margin-bottom: 36px;

  h2 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 10px;
    color: #fff;
    letter-spacing: 0.5px;
  }

  p {
    color: rgba(255, 255, 255, 0.65);
    font-size: 14.5px;
  }
}

.welcome-field {
  width: 100%;
  margin-bottom: 28px;
}

.input-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}

.welcome-input {
  width: 100%;
  height: 60px;
  padding: 0 54px 0 24px;
  background: rgba(0, 0, 0, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: inset 0 2px 6px rgba(0,0,0,0.15);

  &::placeholder {
    color: rgba(255, 255, 255, 0.35);
    font-weight: 400;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.1);
  }

  &:focus {
    outline: none;
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 182, 193, 0.6);
    box-shadow: 0 0 0 4px rgba(255, 182, 193, 0.2), inset 0 2px 4px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }
}

.input-icon-active {
  position: absolute;
  right: 22px;
  color: #ffb6c1;
  filter: drop-shadow(0 0 6px rgba(255, 182, 193, 0.6));
  animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes pop-in {
  0% { transform: scale(0) rotate(-15deg); opacity: 0; }
  60% { transform: scale(1.2) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.welcome-submit {
  width: 100%;
  height: 56px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 182, 193, 0.95), rgba(216, 191, 216, 0.95));
  color: #4a2845;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 10px 24px rgba(255, 182, 193, 0.3);
  overflow: hidden;
  position: relative;
  margin-bottom: 20px;

  &::after {
    content: '';
    position: absolute;
    top: 0; left: -100%; width: 50%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
    transition: none;
  }

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 14px 32px rgba(255, 182, 193, 0.45);
    color: #2d182b;
    
    &::after {
      animation: shine 1.2s ease;
    }
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: 0 6px 16px rgba(255, 182, 193, 0.3);
  }

  &:disabled {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.3);
    box-shadow: none;
    cursor: not-allowed;
  }

  &.is-loading {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
    animation: pulse 1.5s infinite;
  }
}

@keyframes shine {
  0% { left: -100%; }
  100% { left: 200%; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.welcome-error {
  color: #ffb3b3;
  font-size: 13.5px;
  text-align: center;
  margin-bottom: 16px;
  background: rgba(255, 153, 153, 0.12);
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 153, 153, 0.25);
  font-weight: 500;
}

.welcome-hint {
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
  letter-spacing: 0.5px;
}

/* Animations */
.welcome-scene-enter-active {
  transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.welcome-scene-leave-active {
  transition: all 0.5s ease-in;
}

.welcome-scene-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
  filter: blur(12px);
}
.welcome-scene-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
  filter: blur(6px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .welcome-stage {
    padding: 16px;
  }

  .welcome-form-card {
    padding: 32px 24px 24px;
    border-radius: 28px;
  }
}
</style>
