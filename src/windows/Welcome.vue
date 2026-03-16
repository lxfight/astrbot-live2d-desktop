<template>
  <WindowShell
    title="欢迎使用"
    subtitle="先确认你的桌面身份，然后进入 Live2D 舞台。"
    eyebrow="AstrBot First Run"
    :icon="Drama"
    centered
    @close="handleClose"
  >
    <template #hero>
      <div class="welcome-hero">
        <div>
          <span class="welcome-hero__badge">首次启动</span>
          <h2>从你的名字开始，让桌面角色知道该如何称呼你。</h2>
        </div>
        <div class="welcome-hero__theme" :style="themeSwatchStyle"></div>
      </div>
    </template>

    <transition name="welcome-fade" mode="out-in">
      <section v-if="stage === 'intro'" key="intro" class="welcome-card panel-card">
        <div class="welcome-mark">
          <span class="welcome-mark__core"></span>
          <span class="welcome-mark__ring"></span>
        </div>
        <h3>AstrBot Live2D Desktop</h3>
        <p>界面主题会跟随当前模型的主色，并在多个窗口之间自动同步。</p>
      </section>

      <section v-else key="form" class="welcome-card panel-card">
        <div class="welcome-copy">
          <h3>如何称呼你？</h3>
          <p>这个名字会作为桌面端发送消息时的默认身份，可以稍后在数据库中再修改。</p>
        </div>

        <div class="welcome-form">
          <input
            ref="nameInput"
            v-model="userName"
            type="text"
            class="welcome-input"
            placeholder="请输入你的昵称"
            maxlength="20"
            @keyup.enter="handleSubmit"
          />

          <button class="welcome-submit" type="button" :disabled="!userName.trim() || isSubmitting" @click="handleSubmit">
            <span v-if="!isSubmitting">进入桌面</span>
            <span v-else>正在初始化...</span>
          </button>
        </div>

        <span class="welcome-hint">按 Enter 键也可以继续</span>
      </section>
    </transition>
  </WindowShell>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Drama } from 'lucide-vue-next'
import WindowShell from '@/components/WindowShell.vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { palette } = storeToRefs(themeStore)

const stage = ref<'intro' | 'form'>('intro')
const userName = ref('')
const isSubmitting = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)

const themeSwatchStyle = computed(() => ({
  background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
  boxShadow: `0 18px 42px ${palette.value.shadowColor}`,
}))

onMounted(() => {
  themeStore.syncFromStorage()
  setTimeout(() => {
    stage.value = 'form'
    setTimeout(() => {
      nextTick(() => nameInput.value?.focus())
    }, 220)
  }, 1400)
})

async function handleSubmit() {
  const name = userName.value.trim()
  if (!name || isSubmitting.value) return

  isSubmitting.value = true

  try {
    await new Promise((resolve) => setTimeout(resolve, 420))
    await window.electron.user.setUserName(name)
  } catch (error) {
    console.error('[Welcome] 设置用户名称失败:', error)
    isSubmitting.value = false
  }
}

function handleClose() {
  window.electron.window.closeWelcome()
}
</script>

<style scoped lang="scss">
.welcome-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 8px 0 0;
    max-width: 560px;
    font-size: 20px;
    line-height: 1.3;
    letter-spacing: -0.04em;
  }
}

.welcome-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.14);
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 700;
}

.welcome-hero__theme {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  flex-shrink: 0;
}

.welcome-card {
  width: min(520px, 100%);
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  background: rgba(7, 12, 20, 0.72);
}

.welcome-mark {
  position: relative;
  width: 90px;
  height: 90px;
}

.welcome-mark__core,
.welcome-mark__ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
}

.welcome-mark__core {
  inset: 24px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  box-shadow: 0 18px 40px rgba(var(--color-accent-rgb), 0.3);
}

.welcome-mark__ring {
  border: 1px solid rgba(var(--color-accent-rgb), 0.28);
  animation: welcome-orbit 2.4s linear infinite;
}

.welcome-card h3 {
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: -0.05em;
}

.welcome-card p {
  color: var(--color-text-secondary);
  max-width: 420px;
}

.welcome-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.welcome-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.welcome-input {
  width: 100%;
  height: 54px;
  padding: 0 18px;
  border-radius: 18px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-primary);
  font-size: 16px;
  text-align: center;
  transition: border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);

  &:focus {
    border-color: rgba(var(--color-accent-rgb), 0.34);
    box-shadow: 0 0 0 4px rgba(var(--color-accent-rgb), 0.14);
    background: rgba(255, 255, 255, 0.06);
  }

  &::placeholder {
    color: var(--color-text-tertiary);
  }
}

.welcome-submit {
  width: 100%;
  height: 50px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  color: var(--theme-accent-contrast);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: var(--shadow-soft-accent);
  transition: transform var(--duration-fast) var(--ease-out),
    filter var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: saturate(1.05);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.welcome-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.welcome-fade-enter-active,
.welcome-fade-leave-active {
  transition: opacity var(--duration-slow) var(--ease-out), transform var(--duration-slow) var(--ease-out);
}

.welcome-fade-enter-from,
.welcome-fade-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

@keyframes welcome-orbit {
  from {
    transform: rotate(0deg) scale(0.96);
    opacity: 0.72;
  }

  50% {
    transform: rotate(180deg) scale(1.02);
    opacity: 1;
  }

  to {
    transform: rotate(360deg) scale(0.96);
    opacity: 0.72;
  }
}

@media (max-width: 768px) {
  .welcome-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .welcome-card {
    padding: 22px;
  }
}
</style>
