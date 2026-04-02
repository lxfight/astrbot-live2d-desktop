<template>
  <div class="welcome-screen window-drag-region" :style="welcomeThemeStyle">
    <div class="welcome-screen__backdrop" aria-hidden="true">
      <span class="welcome-screen__aurora welcome-screen__aurora--primary"></span>
      <span class="welcome-screen__aurora welcome-screen__aurora--secondary"></span>
      <span class="welcome-screen__grid"></span>
      <span class="welcome-screen__beam welcome-screen__beam--left"></span>
      <span class="welcome-screen__beam welcome-screen__beam--right"></span>
    </div>

    <header class="welcome-topbar">
      <div class="welcome-topbar__brand">
        <span class="welcome-topbar__eyebrow">AstrBot First Run</span>
        <strong class="welcome-topbar__title">欢迎使用 {{ APP_METADATA.displayName }}</strong>
      </div>

      <button
        class="welcome-topbar__close window-no-drag"
        type="button"
        aria-label="关闭欢迎页"
        @click="handleClose"
      >
        <X :size="16" />
      </button>
    </header>

    <main class="welcome-stage">
      <transition name="welcome-scene" mode="out-in">
        <section v-if="stage === 'intro'" key="intro" class="welcome-scene welcome-scene--intro">
          <div class="welcome-copy-panel">
            <span class="welcome-chip">首次启动</span>
            <p class="welcome-copy-panel__eyebrow">你的桌面身份正在准备接入舞台</p>
            <h1>
              {{ displayNamePrimary }}
              <span>{{ displayNameSecondary }}</span>
            </h1>
            <p class="welcome-copy-panel__lead">
              更通透的界面、跟随模型的主题色，以及更具舞台感的交互入口，都从这一次命名开始。
            </p>

            <div class="welcome-signal-row" aria-label="欢迎页状态">
              <span class="status-pill status-pill--accent">主题同步已启用</span>
              <span class="status-pill">{{ resolvedModelLabel }}</span>
            </div>
          </div>

          <div class="welcome-energy" aria-hidden="true">
            <div class="welcome-energy__halo"></div>
            <div class="welcome-energy__ring welcome-energy__ring--outer"></div>
            <div class="welcome-energy__ring welcome-energy__ring--middle"></div>
            <div class="welcome-energy__ring welcome-energy__ring--inner"></div>
            <div class="welcome-energy__core">
              <div class="welcome-energy__core-mark">A</div>
            </div>
            <div class="welcome-energy__pulse welcome-energy__pulse--a"></div>
            <div class="welcome-energy__pulse welcome-energy__pulse--b"></div>
          </div>

          <div class="welcome-intro-footer">
            <span class="welcome-intro-footer__line"></span>
            <p>正在建立你的专属桌面入口…</p>
          </div>
        </section>

        <section v-else key="form" class="welcome-scene welcome-scene--form">
          <div class="welcome-form-layout">
            <div class="welcome-form-layout__visual">
              <span class="welcome-chip">首次启动</span>
              <p class="welcome-form-layout__eyebrow">透明 / 赛博 / 能量感界面已恢复</p>
              <h2>让桌面角色知道该如何称呼你。</h2>
              <p class="welcome-form-layout__lead">
                名称会作为桌面端默认身份发送消息，后续仍可在数据库中修改。当前界面主题会继续跟随模型主色并在窗口间同步。
              </p>

              <div class="welcome-form-layout__meta">
                <div class="welcome-meta-card">
                  <span class="welcome-meta-card__label">当前主题</span>
                  <strong>{{ paletteHex }}</strong>
                </div>
                <div class="welcome-meta-card">
                  <span class="welcome-meta-card__label">当前来源</span>
                  <strong>{{ resolvedModelLabel }}</strong>
                </div>
              </div>

              <div class="welcome-energy welcome-energy--compact" aria-hidden="true">
                <div class="welcome-energy__halo"></div>
                <div class="welcome-energy__ring welcome-energy__ring--outer"></div>
                <div class="welcome-energy__ring welcome-energy__ring--middle"></div>
                <div class="welcome-energy__ring welcome-energy__ring--inner"></div>
                <div class="welcome-energy__core">
                  <div class="welcome-energy__core-mark">A</div>
                </div>
              </div>
            </div>

            <div class="welcome-cta window-no-drag">
              <div class="welcome-cta__glow" aria-hidden="true"></div>
              <div class="welcome-cta__header">
                <p class="welcome-cta__eyebrow">桌面身份确认</p>
                <h3>如何称呼你？</h3>
                <p>请输入一个你希望桌面角色默认使用的昵称。</p>
              </div>

              <label class="welcome-field" for="welcome-name-input">
                <span class="welcome-field__label">昵称</span>
                <input
                  id="welcome-name-input"
                  ref="nameInput"
                  v-model="userName"
                  type="text"
                  class="welcome-input"
                  placeholder="请输入你的昵称"
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
                <span v-if="!isSubmitting">进入桌面</span>
                <span v-else>正在初始化...</span>
              </button>

              <p
                v-if="submitError"
                class="welcome-error"
                role="alert"
                aria-live="assertive"
              >
                {{ submitError }}
              </p>

              <div class="welcome-cta__footer">
                <span class="welcome-hint">按 Enter 键也可以继续</span>
                <span class="welcome-hint">关闭按钮仍可直接退出欢迎页</span>
              </div>
            </div>
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
import { APP_METADATA } from '@/shared/metadata'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { palette, resolvedModelName, sourceColor } = storeToRefs(themeStore)

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

const resolvedModelLabel = computed(() => resolvedModelName.value || 'AstrBot Live2D')
const paletteHex = computed(() => sourceColor.value.toUpperCase())
const displayNamePrimary = computed(() => APP_METADATA.displayName.split(' ')[0] || APP_METADATA.displayName)
const displayNameSecondary = computed(() => {
  const [, ...rest] = APP_METADATA.displayName.split(' ')
  return rest.join(' ') || APP_METADATA.displayName
})

watch(userName, () => {
  if (submitError.value) {
    submitError.value = ''
  }
})

onMounted(() => {
  themeStore.syncFromStorage()
  themeStore.startStorageSync()

  introTimer = window.setTimeout(() => {
    stage.value = 'form'

    focusTimer = window.setTimeout(() => {
      nextTick(() => nameInput.value?.focus())
    }, 220)
  }, 1400)
})

onBeforeUnmount(() => {
  themeStore.stopStorageSync()

  if (introTimer !== null) {
    clearTimeout(introTimer)
  }

  if (focusTimer !== null) {
    clearTimeout(focusTimer)
  }
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
  color: var(--color-text-primary);
  background:
    radial-gradient(circle at 18% 18%, rgba(var(--color-accent-rgb), 0.22), transparent 32%),
    radial-gradient(circle at 82% 24%, color-mix(in srgb, var(--welcome-chart-3) 42%, transparent), transparent 24%),
    radial-gradient(circle at 50% 72%, rgba(9, 17, 27, 0), rgba(4, 8, 14, 0.66) 58%, rgba(3, 6, 12, 0.92) 100%),
    linear-gradient(160deg, rgba(7, 13, 22, 0.8), rgba(4, 8, 14, 0.96));
}

.welcome-screen__backdrop,
.welcome-stage,
.welcome-topbar {
  position: relative;
  z-index: 1;
}

.welcome-screen__backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.welcome-screen__aurora,
.welcome-screen__beam,
.welcome-screen__grid {
  position: absolute;
  display: block;
}

.welcome-screen__aurora {
  border-radius: 999px;
  filter: blur(72px);
  opacity: 0.9;

  &--primary {
    top: -10%;
    left: -6%;
    width: 36vw;
    height: 36vw;
    min-width: 280px;
    min-height: 280px;
    background: rgba(var(--color-accent-rgb), 0.24);
  }

  &--secondary {
    right: -10%;
    bottom: -14%;
    width: 44vw;
    height: 44vw;
    min-width: 360px;
    min-height: 360px;
    background: color-mix(in srgb, var(--welcome-chart-2) 32%, transparent);
  }
}

.welcome-screen__grid {
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 78px 78px;
  mask-image: radial-gradient(circle at center, black 24%, transparent 86%);
  opacity: 0.22;
}

.welcome-screen__beam {
  top: 50%;
  width: 34vw;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--color-accent-rgb), 0.54), transparent);
  box-shadow: 0 0 24px rgba(var(--color-accent-rgb), 0.34);

  &--left {
    left: 6%;
    transform: rotate(-14deg);
  }

  &--right {
    right: 6%;
    transform: rotate(16deg);
  }
}

.welcome-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 20px 24px 0;
}

.welcome-topbar__brand {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.welcome-topbar__eyebrow {
  color: var(--color-text-tertiary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.welcome-topbar__title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(247, 249, 252, 0.8);
}

.welcome-topbar__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(9, 15, 24, 0.46);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--color-text-secondary);
  backdrop-filter: blur(18px);
  transition:
    transform var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);

  &:hover {
    color: var(--color-text-primary);
    background: rgba(20, 30, 46, 0.72);
    border-color: rgba(var(--color-accent-rgb), 0.32);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.26);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.18);
  }
}

.welcome-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 78px);
  padding: 24px;
}

.welcome-scene {
  width: min(1180px, 100%);
}

.welcome-scene--intro {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
  align-items: center;
  gap: clamp(32px, 5vw, 80px);
  min-height: min(760px, calc(100vh - 150px));
}

.welcome-copy-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
  max-width: 620px;
}

.welcome-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(var(--color-accent-rgb), 0.22);
  background: rgba(var(--color-accent-rgb), 0.1);
  color: var(--color-accent-hover);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.welcome-copy-panel__eyebrow,
.welcome-form-layout__eyebrow,
.welcome-cta__eyebrow {
  color: var(--color-text-tertiary);
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.welcome-copy-panel h1 {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: var(--font-display);
  font-size: clamp(62px, 9vw, 104px);
  line-height: 0.92;
  letter-spacing: -0.08em;
  text-shadow: 0 0 42px rgba(var(--color-accent-rgb), 0.14);

  span {
    font-size: clamp(20px, 2vw, 28px);
    line-height: 1.08;
    letter-spacing: 0.28em;
    color: rgba(247, 249, 252, 0.74);
  }
}

.welcome-copy-panel__lead,
.welcome-form-layout__lead,
.welcome-cta__header p {
  max-width: 560px;
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 1.75;
}

.welcome-signal-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.welcome-energy {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: end;
  width: min(42vw, 520px);
  aspect-ratio: 1;
}

.welcome-energy--compact {
  justify-self: start;
  width: min(280px, 55vw);
}

.welcome-energy__halo,
.welcome-energy__ring,
.welcome-energy__core,
.welcome-energy__pulse {
  position: absolute;
  border-radius: 50%;
}

.welcome-energy__halo {
  inset: 14%;
  background:
    radial-gradient(circle, rgba(var(--color-accent-rgb), 0.28), rgba(var(--color-accent-rgb), 0.04) 44%, transparent 72%),
    radial-gradient(circle at 65% 35%, color-mix(in srgb, var(--welcome-chart-3) 65%, transparent), transparent 34%);
  filter: blur(16px);
}

.welcome-energy__ring {
  inset: 0;
  border: 1px solid rgba(var(--color-accent-rgb), 0.22);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 0 26px rgba(var(--color-accent-rgb), 0.14);

  &--outer {
    animation: energy-spin 18s linear infinite;
  }

  &--middle {
    inset: 10%;
    border-style: dashed;
    border-color: color-mix(in srgb, var(--welcome-chart-1) 52%, transparent);
    animation: energy-spin-reverse 10s linear infinite;
  }

  &--inner {
    inset: 22%;
    border-color: rgba(255, 255, 255, 0.22);
    animation: energy-breathe 3.6s ease-in-out infinite;
  }
}

.welcome-energy__core {
  inset: 34%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.96), rgba(var(--color-accent-rgb), 0.92) 32%, color-mix(in srgb, var(--welcome-chart-2) 72%, #06101b) 88%);
  box-shadow:
    0 0 0 12px rgba(var(--color-accent-rgb), 0.08),
    0 0 60px rgba(var(--color-accent-rgb), 0.34),
    0 0 110px rgba(var(--color-accent-rgb), 0.22);
}

.welcome-energy__core-mark {
  font-size: clamp(28px, 3vw, 40px);
  font-weight: 800;
  letter-spacing: -0.08em;
  color: rgba(3, 7, 14, 0.82);
}

.welcome-energy__pulse {
  inset: 18%;
  border: 1px solid rgba(var(--color-accent-rgb), 0.16);

  &--a {
    animation: energy-pulse 3.4s ease-out infinite;
  }

  &--b {
    animation: energy-pulse 3.4s ease-out 1.7s infinite;
  }
}

.welcome-intro-footer {
  position: absolute;
  right: 0;
  bottom: 28px;
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--color-text-tertiary);
  font-size: 13px;
}

.welcome-intro-footer__line {
  width: 120px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--color-accent-rgb), 0.5));
}

.welcome-form-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 430px);
  align-items: center;
  gap: clamp(28px, 5vw, 72px);
}

.welcome-form-layout__visual {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 22px;
  min-width: 0;
}

.welcome-form-layout__visual h2 {
  max-width: 560px;
  font-size: clamp(38px, 4.8vw, 62px);
  line-height: 1.02;
  letter-spacing: -0.06em;
}

.welcome-form-layout__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.welcome-meta-card {
  min-width: 180px;
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(7, 13, 22, 0.34);
  backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.welcome-meta-card__label {
  display: block;
  margin-bottom: 6px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.welcome-meta-card strong {
  display: block;
  font-size: 15px;
  line-height: 1.4;
  word-break: break-word;
}

.welcome-cta {
  position: relative;
  padding: 28px;
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02) 18%, rgba(4, 8, 14, 0.52)),
    rgba(8, 14, 24, 0.54);
  backdrop-filter: blur(28px) saturate(135%);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.04);
}

.welcome-cta__glow {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(var(--color-accent-rgb), 0.18), transparent 35%, transparent 65%, rgba(var(--color-accent-rgb), 0.12));
  opacity: 0.9;
  pointer-events: none;
}

.welcome-cta__header,
.welcome-field,
.welcome-error,
.welcome-cta__footer,
.welcome-submit {
  position: relative;
  z-index: 1;
}

.welcome-cta__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
}

.welcome-cta__header h3 {
  font-size: 32px;
  line-height: 1.02;
  letter-spacing: -0.05em;
}

.welcome-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.welcome-field__label {
  color: rgba(247, 249, 252, 0.88);
  font-size: 13px;
  font-weight: 600;
}

.welcome-input {
  width: 100%;
  min-height: 60px;
  padding: 0 20px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-primary);
  font-size: 17px;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:hover {
    border-color: rgba(var(--color-accent-rgb), 0.22);
    background: rgba(255, 255, 255, 0.08);
  }

  &:focus {
    border-color: rgba(var(--color-accent-rgb), 0.46);
    background: rgba(255, 255, 255, 0.09);
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.16), 0 18px 40px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }
}

.welcome-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  margin-top: 18px;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 18%),
    linear-gradient(135deg, var(--color-accent), var(--welcome-chart-1));
  color: var(--theme-accent-contrast);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow:
    0 18px 44px rgba(var(--color-accent-rgb), 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
  transition:
    transform var(--duration-fast) var(--ease-out),
    filter var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: saturate(1.08) brightness(1.02);
    box-shadow:
      0 22px 54px rgba(var(--color-accent-rgb), 0.34),
      inset 0 1px 0 rgba(255, 255, 255, 0.34);
  }

  &:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 4px rgba(var(--color-accent-rgb), 0.16),
      0 22px 54px rgba(var(--color-accent-rgb), 0.34);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.welcome-error {
  margin-top: 12px;
  padding: 11px 14px;
  border-radius: 16px;
  border: 1px solid rgba(248, 113, 113, 0.24);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 100%),
    rgba(248, 113, 113, 0.12);
  color: rgba(255, 223, 223, 0.98);
  font-size: 13px;
  line-height: 1.5;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.welcome-cta__footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}

.welcome-hint {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.welcome-scene-enter-active,
.welcome-scene-leave-active {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-out),
    filter var(--duration-slow) var(--ease-out);
}

.welcome-scene-enter-from,
.welcome-scene-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
  filter: blur(8px);
}

@keyframes energy-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes energy-spin-reverse {
  from {
    transform: rotate(0deg) scale(0.98);
  }

  to {
    transform: rotate(-360deg) scale(1.02);
  }
}

@keyframes energy-breathe {
  0%,
  100% {
    transform: scale(0.96);
    opacity: 0.72;
  }

  50% {
    transform: scale(1.04);
    opacity: 1;
  }
}

@keyframes energy-pulse {
  0% {
    transform: scale(0.82);
    opacity: 0;
  }

  24% {
    opacity: 0.38;
  }

  100% {
    transform: scale(1.18);
    opacity: 0;
  }
}

@media (max-width: 980px) {
  .welcome-topbar {
    padding: 18px 18px 0;
  }

  .welcome-stage {
    min-height: calc(100vh - 70px);
    padding: 18px;
  }

  .welcome-scene--intro,
  .welcome-form-layout {
    grid-template-columns: 1fr;
  }

  .welcome-scene--intro {
    min-height: auto;
  }

  .welcome-energy {
    justify-self: center;
    width: min(72vw, 420px);
  }

  .welcome-intro-footer {
    position: static;
    margin-top: 6px;
  }

  .welcome-cta {
    width: min(100%, 460px);
    justify-self: center;
  }
}

@media (max-width: 640px) {
  .welcome-screen__beam {
    display: none;
  }

  .welcome-copy-panel h1 {
    font-size: clamp(48px, 18vw, 72px);
  }

  .welcome-form-layout__visual h2 {
    font-size: clamp(30px, 11vw, 46px);
  }

  .welcome-cta {
    padding: 22px;
    border-radius: 24px;
  }

  .welcome-meta-card {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-energy__ring,
  .welcome-energy__pulse {
    animation: none;
  }

  .welcome-scene-enter-from,
  .welcome-scene-leave-to {
    transform: none;
    filter: none;
  }

  .welcome-input:focus,
  .welcome-submit:hover:not(:disabled) {
    transform: none;
  }
}
</style>
