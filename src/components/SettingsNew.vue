<template>
  <div class="settings-window" :data-theme="effectiveTheme">
    <!-- Title Bar -->
    <header class="title-bar">
      <div class="title-drag-region">
        <span class="window-title">设置</span>
      </div>
      <div class="window-controls">
        <button class="control-btn" @click="minimizeWindow" title="最小化">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"></rect></svg>
        </button>
        <button class="control-btn" @click="maximizeWindow" title="最大化">
          <svg v-if="isMaximized" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1"><path d="M2.5 2.5h7v7h-7z"/><path d="M0.5 0.5h7v7h-7z"/></svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1"><rect x="1.5" y="1.5" width="7" height="7"></rect></svg>
        </button>
        <button class="control-btn close-btn" @click="closeWindow" title="关闭">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1 1l8 8M9 1l-8 8"/></svg>
        </button>
      </div>
    </header>

    <div class="main-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-content">
          <div class="nav-section">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="['nav-item', { active: activeTab === tab.id }]"
              @click="activeTab = tab.id"
            >
              <AppIcon :name="tab.icon" :size="18" class="nav-icon" />
              <span>{{ tab.label }}</span>
            </button>
          </div>
          
          <div class="nav-section mt-auto">
            <!-- Theme Switcher -->
            <div class="theme-switcher">
              <button @click="cycleTheme" class="theme-btn" title="切换主题">
                <AppIcon v-if="themeMode === 'light'" name="sun" :size="16" />
                <AppIcon v-else-if="themeMode === 'dark'" name="moon" :size="16" />
                <AppIcon v-else name="monitor" :size="16" />
                <span>{{ themeMode === 'system' ? '跟随系统' : themeMode === 'light' ? '亮色模式' : '暗色模式' }}</span>
              </button>
            </div>
             <button
              :class="['nav-item', { active: activeTab === 'about' }]"
              @click="activeTab = 'about'"
            >
              <AppIcon name="info" :size="18" class="nav-icon" />
              <span>关于</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="content-area">
        <div class="content-scroll" :class="{ 'no-scroll': activeTab === 'data' }">
          <transition name="fade" mode="out-in">
            <div :key="activeTab" class="tab-container">
              
              <!-- General Tab -->
              <div v-if="activeTab === 'general'">
                <h1 class="page-title">通用</h1>
                <SettingsGeneral 
                  :settings="draft" 
                  :errors="validation.errors"
                  :hotkey-conflict="hotkeyConflict"
                  @update:hotkeyConflict="hotkeyConflict = $event"
                />
              </div>

              <!-- Model Tab -->
              <div v-else-if="activeTab === 'model'">
                <h1 class="page-title">模型</h1>
                <SettingsModel
                  :settings="draft"
                  :default-settings="defaultSettings"
                  @save="attemptSave"
                />
              </div>

              <!-- Interaction Tab -->
              <div v-else-if="activeTab === 'interaction'">
                <h1 class="page-title">交互</h1>
                <section class="group-section">
                  <h2 class="section-header">动作与表情</h2>
                  <SettingsMotionExpressionManager :theme="effectiveTheme" />
                </section>
                <div class="spacer"></div>
                 <section class="group-section">
                  <h2 class="section-header">闲置行为</h2>
                  <SettingsIdleMotion />
                </section>
              </div>

              <!-- Data Tab -->
              <div v-else-if="activeTab === 'data'" class="data-tab">
                <div class="data-tabs-nav">
                  <button 
                    :class="{active: dataSubTab === 'history'}" 
                    @click="dataSubTab = 'history'"
                  >历史记录</button>
                  <button 
                    :class="{active: dataSubTab === 'stats'}" 
                    @click="dataSubTab = 'stats'"
                  >统计信息</button>
                </div>
                <div class="data-content">
                  <ConversationHistory v-show="dataSubTab === 'history'" />
                  <StatisticsView v-show="dataSubTab === 'stats'" />
                </div>
              </div>

              <!-- About Tab -->
              <div v-else-if="activeTab === 'about'">
                <h1 class="page-title">关于</h1>
                <SettingsAbout />
              </div>

            </div>
          </transition>
        </div>

        <!-- Action Footer -->
        <footer class="action-footer" v-if="!['about', 'data'].includes(activeTab)">
          <div class="status-indicator">
             <span v-if="isSaving" class="status-text saving">保存中...</span>
             <span v-else-if="!isDirty" class="status-text saved">已保存</span>
             <span v-else class="status-text dirty">有未保存的更改</span>
          </div>

          <div class="footer-buttons">
            <button 
              class="btn-text" 
              :disabled="!isDirty || isSaving" 
              @click="discardChanges"
            >
              放弃
            </button>
            <button 
              class="btn-primary" 
              :disabled="!isDirty || !validation.isValid || isSaving" 
              @click="attemptSave"
            >
              保存更改
            </button>
          </div>
        </footer>
      </main>
    </div>
    
    <!-- Notifications -->
    <transition name="toast">
      <div v-if="showSaveSuccess" class="toast success">
        <AppIcon name="check" :size="16" />
        <span>设置已保存</span>
      </div>
    </transition>
    <transition name="toast">
      <div v-if="lastSaveError" class="toast error">
        <AppIcon name="alert-triangle" :size="16" />
        <span>{{ lastSaveError }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useSettings } from '../composables/useSettings'
import AppIcon from './icons/AppIcon.vue'
import SettingsGeneral from './settings/SettingsGeneral.vue'
import SettingsModel from './settings/SettingsModel.vue'
import SettingsMotionExpressionManager from './settings/SettingsMotionExpressionManager.vue'
import SettingsIdleMotion from './settings/SettingsIdleMotion.vue'
import SettingsAbout from './settings/SettingsAbout.vue'
import ConversationHistory from './settings/history/ConversationHistory.vue'
import StatisticsView from './settings/statistics/StatisticsView.vue'

const activeTab = ref('general')
const dataSubTab = ref('history')
const isMaximized = ref(false)

const tabs = [
  { id: 'general', label: '通用', icon: 'sliders' },
  { id: 'model', label: '模型', icon: 'cube' },
  { id: 'interaction', label: '交互', icon: 'sparkles' },
  { id: 'data', label: '数据', icon: 'bar-chart' },
]

const {
  draft,
  isDirty,
  validation,
  isSaving,
  lastSaveError,
  showSaveSuccess,
  hotkeyConflict,
  loadSettings,
  saveSettings,
  resetDraft,
  defaultSettings
} = useSettings()

// Theme Management
type ThemeMode = 'light' | 'dark' | 'system'
const themeMode = ref<ThemeMode>('system') // Or load from settings

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

const effectiveTheme = computed(() => {
  if (themeMode.value === 'system') {
    return prefersDark.matches ? 'dark' : 'light'
  }
  return themeMode.value
})

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
}

watch(effectiveTheme, applyTheme, { immediate: true })

onMounted(() => {
  prefersDark.addEventListener('change', () => applyTheme(effectiveTheme.value))
})

const themeCycle: ThemeMode[] = ['system', 'light', 'dark']
function cycleTheme() {
  const currentIndex = themeCycle.indexOf(themeMode.value)
  themeMode.value = themeCycle[(currentIndex + 1) % themeCycle.length]
  // here you would save the theme preference to settings
}


onMounted(async () => {
  await loadSettings()
  checkMaximizedState()
  window.addEventListener('resize', checkMaximizedState)
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMaximizedState)
  window.removeEventListener('keydown', onGlobalKeydown)
})

const checkMaximizedState = async () => {
  if (window.electronAPI?.isMaximized) {
    isMaximized.value = await window.electronAPI.isMaximized()
  }
}

const minimizeWindow = () => window.electronAPI?.minimize()
const maximizeWindow = async () => {
  await window.electronAPI?.maximize()
  setTimeout(checkMaximizedState, 100)
}
const closeWindow = () => {
  if (isDirty.value && !confirm('更改未保存，确定要关闭吗？')) return
  window.electronAPI?.close()
}

const attemptSave = async () => {
  if (!validation.value.isValid) return
  await saveSettings()
}

const discardChanges = () => resetDraft()

const onGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    if (isDirty.value && !isSaving.value) attemptSave()
  }
}
</script>

<style>
/* CSS Variables for Theming */
:root {
  --bg-app: #f3f4f6;
  --bg-sidebar: #ffffff;
  --bg-titlebar: #ffffff;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-tertiary: #9ca3af;
  
  --border-color: #e5e7eb;
  --border-hover: #d1d5db;
  
  --primary-color: #000000;
  --primary-color-alpha: rgba(0,0,0,0.1);
  --primary-fg: #ffffff;
  
  /* Button Colors (Reversed) */
  --btn-bg: #ffffff;
  --btn-fg: #000000;
  
  --surface-color: #ffffff;
  --input-bg: #f9fafb;
  --hover-bg: #f3f4f6;
  --active-bg: #e5e7eb;
  
  --switch-off: #d1d5db;
  --danger-color: #ef4444;
  
  --sidebar-width: 220px;
  --title-bar-height: 32px;
}

[data-theme='dark'] {
  --bg-app: #1e1e1e;
  --bg-sidebar: #252525;
  --bg-titlebar: #252525;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-tertiary: #707070;
  
  --border-color: #3a3a3a;
  --border-hover: #505050;
  
  --primary-color: #ffffff;
  --primary-color-alpha: rgba(255,255,255,0.1);
  --primary-fg: #000000;
  
  /* Button Colors (Reversed) */
  --btn-bg: #000000;
  --btn-fg: #ffffff;
  
  --surface-color: #2a2a2a;
  --input-bg: #2a2a2a;
  --hover-bg: #333333;
  --active-bg: #444444;

  --switch-off: #555;
}


body {
  margin: 0;
  font-family: "Segoe UI", "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
}

* {
  box-sizing: border-box;
}
</style>

<style scoped>
.settings-window {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  color: var(--text-primary);
  overflow: hidden;
  border: 1px solid var(--border-color);
  transition: background 0.3s, color 0.3s;
}

/* Title Bar */
.title-bar {
  height: var(--title-bar-height);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-titlebar);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  transition: background 0.3s, border-color 0.3s;
}

.title-drag-region {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  padding-left: 16px;
}

.window-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.window-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 100%;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
}

.control-btn:hover {
  background: rgba(0,0,0,0.05);
}

[data-theme='dark'] .control-btn:hover {
  background: rgba(255,255,255,0.1);
}

.control-btn.close-btn:hover {
  background: #e81123;
  color: white;
}

/* Layout */
.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 16px 8px;
  transition: background 0.3s, border-color 0.3s;
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-section.mt-auto {
  margin-top: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--active-bg);
  color: var(--text-primary);
  font-weight: 600;
}

.theme-switcher {
  padding: 4px 0;
}

.theme-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}
.theme-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

/* Content Area */
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-app);
}

.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 32px 48px;
}

.content-scroll.no-scroll {
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.content-scroll.no-scroll .tab-container {
  height: 100%;
  max-width: none;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.tab-container {
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 32px 0;
  color: var(--text-primary);
}

.section-header {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.group-section {
  margin-bottom: 24px;
}

.spacer {
  height: 24px;
}

/* Data Tab */
.data-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.data-tabs-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
}
.data-tabs-nav button {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 15px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.data-tabs-nav button:hover {
  color: var(--text-primary);
}
.data-tabs-nav button.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
  font-weight: 600;
}
.data-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}


/* Footer */
.action-footer {
  padding: 16px 48px;
  border-top: 1px solid var(--border-color);
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  z-index: 10;
  transition: background 0.3s, border-color 0.3s;
}

[data-theme='dark'] .action-footer {
  background: rgba(42,42,42,0.8);
}


.status-indicator {
  margin-right: auto;
}

.status-text {
  font-size: 13px;
}
.status-text.saved { color: var(--text-tertiary); }
.status-text.saving { color: var(--text-primary); }
.status-text.dirty { color: #f59e0b; }

.btn-primary {
  padding: 8px 20px;
  background: var(--btn-bg);
  color: var(--btn-fg);
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-text {
  padding: 8px 16px;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-text:hover {
  color: var(--text-primary);
}

.btn-text:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #333;
  color: white;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 100;
}

[data-theme='dark'] .toast {
  background: #f0f0f0;
  color: #1a1a1a;
}

.toast.error {
  background: var(--danger-color);
  color: white;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>