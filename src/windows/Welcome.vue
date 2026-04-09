<template>
  <div class="welcome-screen window-drag-region" :style="welcomeThemeStyle">
    <div class="welcome-screen__backdrop" aria-hidden="true">
      <span class="welcome-screen__glow welcome-screen__glow--primary"></span>
      <span class="welcome-screen__glow welcome-screen__glow--secondary"></span>
      <span
        v-for="i in 12"
        :key="i"
        class="welcome-screen__bubble"
        :style="bubbleStyle(i)"
      ></span>
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
          <div class="welcome-mascot" aria-hidden="true">
            <div class="welcome-mascot__body">
              <span class="welcome-mascot__face">A</span>
            </div>
            <div class="welcome-mascot__shadow"></div>
          </div>

          <h1 class="welcome-greeting">
            嗨～ 我是你的桌面小伙伴
          </h1>
          <p class="welcome-subtitle">正在为你准备一个温馨的小窝…</p>
        </section>

        <section v-else key="form" class="welcome-scene welcome-scene--form">
          <div class="welcome-form-card window-no-drag">
            <div class="welcome-mascot welcome-mascot--small" aria-hidden="true">
              <div class="welcome-mascot__body">
                <span class="welcome-mascot__face">A</span>
              </div>
            </div>

            <div class="welcome-form-card__header">
              <h2>该怎么称呼你呀？</h2>
              <p>告诉我你的名字，这样我就能记住你啦～</p>
            </div>

            <label class="welcome-field" for="welcome-name-input">
              <span class="welcome-field__label">你的昵称</span>
              <input
                id="welcome-name-input"
                ref="nameInput"
                v-model="userName"
                type="text"
                class="welcome-input"
                placeholder="输入你喜欢的昵称"
                maxlength="20"
                autocomplete="nickname"
                @keyup.enter="handleSubmit"
              />
            </label>

            <button
              class="welcome-submit"
              type="button"
              :disabled="!userName.trim() || isSubmitting"
              @click="handleSubmit"
            >
              <span v-if="!isSubmitting">开始陪伴</span>
              <span v-else>马上就好…</span>
            </button>

            <p
              v-if="submitError"
              class="welcome-error"
              role="alert"
              aria-live="assertive"
            >
              {{ submitError }}
            </p>

            <span class="welcome-hint">按 Enter 也可以继续</span>
          </div>
        </section>
      </transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { X } from 'lucide-vue-next'
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

function bubbleStyle(i: number) {
  const seed = i * 137.508
  const left = (seed * 7.3) % 100
  const size = 4 + (seed % 12)
  const delay = (seed % 8).toFixed(1)
  const duration = 6 + (seed % 6)
  return {
    left: `${left}%`,
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
    }, 220)
  }, 1800)
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
    await new Promise((resolve) => setTimeout(resolve, 420))
    await window.electron.user.setUserName(name)
  } catch (error) {
    console.error('[Welcome] 设置用户名称失败:', error)
    submitError.value = '初始化失败，请检查桌面环境后重试。'
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
  color: var(--color-text-primary);
  background:
    radial-gradient(ellipse at 30% 20%, rgba(var(--color-accent-rgb), 0.12), transparent 50%),
    radial-gradient(ellipse at 70% 80%, color-mix(in srgb, var(--welcome-chart-3) 18%, transparent), transparent 50%),
    linear-gradient(160deg, rgba(18, 22, 32, 0.95), rgba(12, 16, 26, 1));
}

.welcome-screen__backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.welcome-screen__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);

  &--primary {
    top: -15%;
    left: -8%;
    width: 40vw;
    height: 40vw;
    min-width: 260px;
    min-height: 260px;
    background: rgba(var(--color-accent-rgb), 0.1);
  }

  &--secondary {
    bottom: -20%;
    right: -10%;
    width: 50vw;
    height: 50vw;
    min-width: 300px;
    min-height: 300px;
    background: color-mix(in srgb, var(--welcome-chart-2) 14%, transparent);
  }
}

.welcome-screen__bubble {
  position: absolute;
  bottom: -20px;
  border-radius: 50%;
  background: rgba(var(--color-accent-rgb), 0.12);
  animation: bubble-float linear infinite;
  opacity: 0;
}

.welcome-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--color-text-tertiary);
  backdrop-filter: blur(12px);
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: var(--color-text-primary);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.2);
  }
}

.welcome-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  z-index: 1;
}

.welcome-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.welcome-scene--intro {
  gap: 20px;
}

.welcome-mascot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.welcome-mascot__body {
  width: 96px;
  height: 96px;
  border-radius: 32px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.15), transparent 40%),
    linear-gradient(145deg, var(--welcome-accent, var(--color-accent)), color-mix(in srgb, var(--welcome-chart-1, var(--color-accent)) 80%, #1a1a2e));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 8px 32px rgba(var(--color-accent-rgb), 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: mascot-bounce 2s ease-in-out infinite;

  .welcome-mascot--small & {
    width: 64px;
    height: 64px;
    border-radius: 22px;
    animation: mascot-wiggle 3s ease-in-out infinite;
  }
}

.welcome-mascot__face {
  font-size: 38px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: -0.04em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  .welcome-mascot--small & {
    font-size: 26px;
  }
}

.welcome-mascot__shadow {
  width: 56px;
  height: 8px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.18);
  filter: blur(4px);
  animation: shadow-pulse 2s ease-in-out infinite;
}

.welcome-greeting {
  font-family: var(--font-display);
  font-size: clamp(26px, 4vw, 36px);
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(var(--color-accent-rgb), 0.8));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.welcome-subtitle {
  color: var(--color-text-tertiary);
  font-size: 15px;
  line-height: 1.6;
}

.welcome-scene--form {
  width: min(420px, 100%);
}

.welcome-form-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  padding: 36px 32px 28px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01) 40%, rgba(4, 8, 14, 0.4)),
    rgba(14, 18, 28, 0.7);
  backdrop-filter: blur(24px) saturate(120%);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.welcome-form-card__header {
  text-align: center;

  h2 {
    font-size: clamp(22px, 3.5vw, 28px);
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }

  p {
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }
}

.welcome-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.welcome-field__label {
  color: rgba(247, 249, 252, 0.7);
  font-size: 13px;
  font-weight: 600;
  padding-left: 4px;
}

.welcome-input {
  width: 100%;
  min-height: 52px;
  padding: 0 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
  font-size: 16px;
  text-align: center;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:hover {
    border-color: rgba(var(--color-accent-rgb), 0.2);
    background: rgba(255, 255, 255, 0.07);
  }

  &:focus {
    border-color: rgba(var(--color-accent-rgb), 0.4);
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.12);
    outline: none;
  }
}

.welcome-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--welcome-chart-1, var(--color-accent)) 80%, #2a1a4e));
  color: rgba(255, 255, 255, 0.95);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 8px 24px rgba(var(--color-accent-rgb), 0.2);
  transition:
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 32px rgba(var(--color-accent-rgb), 0.28);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.2), 0 8px 24px rgba(var(--color-accent-rgb), 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.welcome-error {
  width: 100%;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(248, 113, 113, 0.2);
  background: rgba(248, 113, 113, 0.08);
  color: rgba(255, 200, 200, 0.95);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.welcome-hint {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

/* 场景切换动画 */
.welcome-scene-enter-active,
.welcome-scene-leave-active {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-out);
}

.welcome-scene-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

.welcome-scene-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* 吉祥物弹跳 */
@keyframes mascot-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 吉祥物摇摆 */
@keyframes mascot-wiggle {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-4deg);
  }
  75% {
    transform: rotate(4deg);
  }
}

/* 阴影脉冲 */
@keyframes shadow-pulse {
  0%, 100% {
    transform: scaleX(1);
    opacity: 0.18;
  }
  50% {
    transform: scaleX(0.7);
    opacity: 0.1;
  }
}

/* 气泡浮动 */
@keyframes bubble-float {
  0% {
    transform: translateY(0) scale(0);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
    transform: translateY(-10vh) scale(1);
  }
  90% {
    opacity: 0.3;
  }
  100% {
    transform: translateY(-110vh) scale(0.6);
    opacity: 0;
  }
}

@media (max-width: 640px) {
  .welcome-stage {
    padding: 16px;
  }

  .welcome-form-card {
    padding: 28px 22px 22px;
    border-radius: 22px;
  }

  .welcome-mascot__body {
    width: 80px;
    height: 80px;
    border-radius: 26px;
  }

  .welcome-mascot__face {
    font-size: 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-mascot__body,
  .welcome-mascot__shadow,
  .welcome-screen__bubble {
    animation: none;
  }

  .welcome-scene-enter-from,
  .welcome-scene-leave-to {
    transform: none;
  }

  .welcome-submit:hover:not(:disabled) {
    transform: none;
  }
}
</style>
