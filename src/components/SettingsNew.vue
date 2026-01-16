<template>
  <div class="settings-container" :data-theme="theme">
    <!-- 顶部栏 -->
    <header class="window-header">
      <div class="window-drag-bar">
        <div class="app-title">
          <span class="project-name">AstrBot Live2D Desktop</span>
          <span class="author">by lxfight</span>
        </div>
      </div>

      <div class="window-actions">
        <button
          type="button"
          class="theme-toggle"
          :title="theme === 'dark' ? '切换到浅色主题' : '切换到暗色主题'"
          @click="toggleTheme"
        >
          <span class="theme-toggle-icon">
            <svg v-if="theme === 'dark'" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 19v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M4.22 5.22l1.42 1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M18.36 18.36l1.42 1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M3 12h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M19 12h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M4.22 18.78l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 13.5a8 8 0 1 1-10.5-10a6 6 0 1 0 10.5 10Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="theme-toggle-text">{{ theme === 'dark' ? '浅色' : '暗色' }}</span>
        </button>

        <button @click="closeSettings" class="window-close-btn" title="关闭设置">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M 1,1 L 11,11 M 11,1 L 1,11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- 主体区域（左右布局） -->
    <div class="settings-body">
      <!-- 左侧导航 -->
      <aside class="settings-sidebar">
        <div class="sidebar-header">
          <h1>设置</h1>
        </div>
        <nav class="sidebar-nav">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="['nav-item', { active: activeTab === tab.key }]"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>
      </aside>

      <!-- 右侧内容区 -->
      <main class="settings-main">
        <div
          class="settings-content"
          :class="{
            'settings-content-history': activeTab === 'history',
            'settings-content-statistics': activeTab === 'statistics'
          }"
        >
          <!-- 使用子组件 -->
          <div v-show="activeTab === 'basic'">
            <SettingsBasic
              :settings="settings"
              @save="saveSettings"
            />
          </div>

          <div v-show="activeTab === 'websocket'">
            <SettingsWebSocket
              :settings="settings"
              @save="saveSettings"
            />
          </div>

          <div v-show="activeTab === 'model'">
            <SettingsModel
              :settings="settings"
              :default-settings="defaultSettings"
              @save="saveSettings"
            />
          </div>

          <!-- 对话历史 - 使用现有组件 -->
          <ConversationHistory v-if="activeTab === 'history'" />

          <!-- 数据统计 - 使用现有组件 -->
          <StatisticsView v-if="activeTab === 'statistics'" />

          <div v-show="activeTab === 'system'">
            <SettingsSystem
              :settings="settings"
              :hotkey-conflict="hotkeyConflict"
              @save="saveSettings"
              @update:hotkeyConflict="hotkeyConflict = $event"
            />
          </div>

          <div v-show="activeTab === 'about'">
            <SettingsAbout />
          </div>
        </div>

        <div v-if="activeTab !== 'history' && activeTab !== 'statistics' && activeTab !== 'about'" class="settings-footer">
          <button @click="resetSettings" class="btn btn-secondary">恢复默认</button>
          <button @click="saveSettings" class="btn btn-primary">保存设置</button>
        </div>
      </main>
    </div>

    <!-- 保存成功提示 -->
    <div v-if="showSaveSuccess" class="save-success">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
        <path d="M13.5 3 L6 10.5 L2.5 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      设置已保存
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'
import SettingsAbout from './settings/SettingsAbout.vue'
import SettingsBasic from './settings/SettingsBasic.vue'
import SettingsModel from './settings/SettingsModel.vue'
import SettingsWebSocket from './settings/SettingsWebSocket.vue'
import SettingsSystem from './settings/SettingsSystem.vue'
import ConversationHistory from './settings/history/ConversationHistory.vue'
import StatisticsView from './settings/statistics/StatisticsView.vue'

type ThemeMode = 'light' | 'dark'

const theme = ref<ThemeMode>('light')

// 标签页定义
const tabs = [
  { key: 'basic', label: '基础设置' },
  { key: 'model', label: '模型设置' },
  { key: 'websocket', label: 'WebSocket' },
  { key: 'history', label: '对话历史' },
  { key: 'statistics', label: '数据统计' },
  { key: 'system', label: '系统设置' },
  { key: 'about', label: '关于' }
]

const activeTab = ref('basic')

// 使用 composable 管理设置
const {
  settings,
  showSaveSuccess,
  hotkeyConflict,
  loadSettings,
  saveSettings,
  resetSettings,
  defaultSettings
} = useSettings()

onMounted(async () => {
  const savedTheme = localStorage.getItem('astrbot.settings.theme') as ThemeMode | null
  if (savedTheme === 'light' || savedTheme === 'dark') {
    theme.value = savedTheme
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    theme.value = 'dark'
  }
  await loadSettings()
})

const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('astrbot.settings.theme', theme.value)
}

const closeSettings = () => {
  window.close()
}
</script>

<style scoped>
.settings-container {
  --accent: #ff7bb6;
  --accent-2: #6aa8ff;
  --success: rgba(62, 201, 163, 0.92);
  --danger: rgba(220, 60, 95, 0.92);

  --text: #2b2b33;
  --text-muted: rgba(43, 43, 51, 0.6);
  --border: rgba(255, 255, 255, 0.9);
  --border-soft: rgba(43, 43, 51, 0.08);
  --shadow: rgba(60, 72, 98, 0.12);

  --glass: rgba(255, 255, 255, 0.64);
  --glass-strong: rgba(255, 255, 255, 0.72);
  --input-bg: rgba(255, 255, 255, 0.78);

  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  font-family: ui-rounded, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  background:
    radial-gradient(1200px 800px at 20% 10%, rgba(255, 210, 230, 0.9), rgba(255, 210, 230, 0) 55%),
    radial-gradient(1100px 900px at 85% 20%, rgba(195, 220, 255, 0.95), rgba(195, 220, 255, 0) 60%),
    radial-gradient(900px 700px at 60% 90%, rgba(233, 206, 255, 0.9), rgba(233, 206, 255, 0) 55%),
    linear-gradient(135deg, #fff6fb 0%, #f1f6ff 45%, #fff1fb 100%);
  color: var(--text);
  color-scheme: light;
  overflow: hidden;
}

.settings-container[data-theme="dark"] {
  --accent: #ff6ec7;
  --accent-2: #67b7ff;
  --success: rgba(62, 201, 163, 0.92);
  --danger: rgba(220, 60, 95, 0.92);

  --text: rgba(255, 255, 255, 0.92);
  --text-muted: rgba(255, 255, 255, 0.62);
  --border: rgba(255, 255, 255, 0.14);
  --border-soft: rgba(255, 255, 255, 0.1);
  --shadow: rgba(0, 0, 0, 0.4);

  --glass: rgba(10, 14, 26, 0.55);
  --glass-strong: rgba(10, 14, 26, 0.7);
  --input-bg: rgba(10, 14, 26, 0.62);

  background:
    radial-gradient(1100px 900px at 20% 10%, rgba(255, 110, 199, 0.22), rgba(255, 110, 199, 0) 55%),
    radial-gradient(1100px 900px at 85% 20%, rgba(103, 183, 255, 0.2), rgba(103, 183, 255, 0) 60%),
    radial-gradient(900px 700px at 60% 90%, rgba(188, 130, 255, 0.18), rgba(188, 130, 255, 0) 55%),
    linear-gradient(135deg, #070a12 0%, #0b1022 45%, #090a18 100%);
  color-scheme: dark;
}

.settings-container::before {
  content: "";
  position: absolute;
  inset: -40px;
  background:
    radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.9) 0 2px, rgba(255, 255, 255, 0) 3px),
    radial-gradient(circle at 55% 35%, rgba(255, 255, 255, 0.85) 0 1.5px, rgba(255, 255, 255, 0) 3px),
    radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.8) 0 2px, rgba(255, 255, 255, 0) 3px),
    radial-gradient(circle at 30% 80%, rgba(255, 255, 255, 0.75) 0 1.6px, rgba(255, 255, 255, 0) 3px);
  opacity: 0.45;
  filter: blur(0.2px);
  pointer-events: none;
}

.window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 14px;
  background: var(--glass-strong);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 10px 30px var(--shadow);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-app-region: drag;
}

.window-drag-bar {
  flex: 1;
  display: flex;
  align-items: center;
}

.app-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.project-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.author {
  font-size: 12px;
  color: var(--text-muted);
}

.window-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.55);
  color: rgba(43, 43, 51, 0.8);
  cursor: pointer;
  transition: all 0.2s;
}

.settings-container[data-theme="dark"] .theme-toggle {
  background: rgba(10, 14, 26, 0.6);
  color: rgba(255, 255, 255, 0.82);
}

.theme-toggle:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.95);
}

.theme-toggle-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.theme-toggle-text {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.window-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--border);
  color: rgba(43, 43, 51, 0.72);
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.2s;
}

.settings-container[data-theme="dark"] .window-close-btn {
  background: rgba(10, 14, 26, 0.6);
  color: rgba(255, 255, 255, 0.75);
}

.window-close-btn:hover {
  background: rgba(255, 214, 230, 0.75);
  color: #c02757;
  transform: translateY(-1px);
}

.settings-body {
  flex: 1;
  display: flex;
  gap: 14px;
  padding: 14px;
  overflow: hidden;
}

.settings-sidebar {
  width: 220px;
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 18px 50px var(--shadow);
  backdrop-filter: blur(18px) saturate(1.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 18px 16px 14px 16px;
  border-bottom: 1px solid var(--border);
}

.sidebar-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.5px;
}

.sidebar-nav {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
}

.nav-item {
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--border);
  color: rgba(43, 43, 51, 0.78);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 12px;
  margin-bottom: 8px;
}

.settings-container[data-theme="dark"] .nav-item {
  background: rgba(10, 14, 26, 0.55);
  color: rgba(255, 255, 255, 0.74);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.78);
  color: rgba(43, 43, 51, 0.9);
  transform: translateY(-1px);
}

.settings-container[data-theme="dark"] .nav-item:hover {
  background: rgba(10, 14, 26, 0.72);
  color: rgba(255, 255, 255, 0.92);
}

.nav-item.active {
  background: linear-gradient(135deg, rgba(255, 193, 222, 0.85), rgba(198, 220, 255, 0.85));
  color: rgba(43, 43, 51, 0.92);
  border-color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10px 22px var(--shadow);
}

.settings-container[data-theme="dark"] .nav-item.active {
  background: linear-gradient(135deg, rgba(255, 110, 199, 0.3), rgba(103, 183, 255, 0.28));
  color: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.18);
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 18px 50px var(--shadow);
  backdrop-filter: blur(18px) saturate(1.2);
}

.settings-content {
  flex: 1;
  padding: 22px 22px 18px 22px;
  overflow-y: auto;
}

.settings-content.settings-content-history {
  padding: 14px;
  overflow: hidden;
}

.settings-content.settings-content-statistics {
  padding: 14px;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 18px;
  background: var(--glass-strong);
  border-top: 1px solid var(--border);
}

.btn {
  padding: 10px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.75);
  color: rgba(43, 43, 51, 0.85);
}

.settings-container[data-theme="dark"] .btn-secondary {
  background: rgba(10, 14, 26, 0.62);
  color: rgba(255, 255, 255, 0.84);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
}

.settings-container[data-theme="dark"] .btn-secondary:hover {
  background: rgba(10, 14, 26, 0.78);
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  box-shadow: 0 14px 30px rgba(106, 168, 255, 0.22);
}

.btn-primary:hover {
  filter: brightness(1.02);
  transform: translateY(-1px);
}

.save-success {
  position: fixed;
  top: 60px;
  right: 32px;
  padding: 12px 20px;
  background: var(--success);
  color: #fff;
  border-radius: 14px;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 18px 40px rgba(60, 72, 98, 0.18);
  animation: slideIn 0.3s ease-out;
  z-index: 1000;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.settings-sidebar::-webkit-scrollbar,
.settings-content::-webkit-scrollbar {
  width: 10px;
}

.settings-sidebar::-webkit-scrollbar-thumb,
.settings-content::-webkit-scrollbar-thumb {
  background: rgba(255, 193, 222, 0.65);
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.9);
}

.settings-container[data-theme="dark"] .settings-sidebar::-webkit-scrollbar-thumb,
.settings-container[data-theme="dark"] .settings-content::-webkit-scrollbar-thumb {
  background: rgba(255, 110, 199, 0.28);
  border-color: rgba(255, 255, 255, 0.14);
}

.settings-sidebar::-webkit-scrollbar-track,
.settings-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.55);
  border-radius: 999px;
}

.settings-container[data-theme="dark"] .settings-sidebar::-webkit-scrollbar-track,
.settings-container[data-theme="dark"] .settings-content::-webkit-scrollbar-track {
  background: rgba(10, 14, 26, 0.5);
}

.settings-content :deep(.settings-section) {
  max-width: 980px;
  margin: 0 auto;
  padding: 18px 18px 14px 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(60, 72, 98, 0.1);
  backdrop-filter: blur(18px) saturate(1.2);
}

.settings-container[data-theme="dark"] .settings-content :deep(.settings-section) {
  background: rgba(10, 14, 26, 0.55);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
}

.settings-content :deep(.settings-section > h2) {
  margin: 0 0 14px 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: 0.4px;
  padding-bottom: 10px;
  background-image: linear-gradient(90deg, rgba(255, 123, 182, 0.9), rgba(106, 168, 255, 0.9));
  background-repeat: no-repeat;
  background-size: 120px 3px;
  background-position: left bottom;
}

.settings-content :deep(.settings-section h2) {
  color: var(--text);
}

.settings-content :deep(.settings-section h3),
.settings-content :deep(.settings-section h4) {
  color: var(--text);
}

.settings-content :deep(.settings-section p),
.settings-content :deep(.settings-section li),
.settings-content :deep(.settings-section span) {
  color: inherit;
  word-break: break-word;
  white-space: normal;
}

.settings-content :deep(.settings-section .detail-item .label) {
  color: var(--text-muted);
}

.settings-content :deep(.settings-section .detail-item .value) {
  color: var(--text);
}

.settings-content :deep(.settings-section .setting-item .value) {
  color: var(--text-muted);
}

.settings-container[data-theme="dark"] .settings-content :deep(.settings-section > h2) {
  background-image: linear-gradient(90deg, rgba(255, 110, 199, 0.85), rgba(103, 183, 255, 0.85));
}

.settings-content :deep(.settings-section .setting-item) {
  border-bottom: 1px solid var(--border-soft);
}

.settings-content :deep(.settings-section .setting-item:last-of-type) {
  border-bottom: none;
}

.settings-content :deep(.settings-section .setting-item label) {
  color: rgba(43, 43, 51, 0.86);
}

.settings-container[data-theme="dark"] .settings-content :deep(.settings-section .setting-item label) {
  color: rgba(255, 255, 255, 0.86);
}

.settings-content :deep(.settings-section .hint),
.settings-content :deep(.settings-section .loading-text) {
  color: var(--text-muted);
}

.settings-content :deep(.text-input),
.settings-content :deep(.hotkey-input),
.settings-content :deep(input[type="text"]),
.settings-content :deep(input[type="password"]) {
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  box-shadow: 0 10px 24px rgba(60, 72, 98, 0.08);
}

.settings-content :deep(.text-input::placeholder),
.settings-content :deep(.hotkey-input::placeholder),
.settings-content :deep(input[type="text"]::placeholder),
.settings-content :deep(input[type="password"]::placeholder) {
  color: rgba(43, 43, 51, 0.45);
}

.settings-container[data-theme="dark"] .settings-content :deep(.text-input::placeholder),
.settings-container[data-theme="dark"] .settings-content :deep(.hotkey-input::placeholder),
.settings-container[data-theme="dark"] .settings-content :deep(input[type="text"]::placeholder),
.settings-container[data-theme="dark"] .settings-content :deep(input[type="password"]::placeholder) {
  color: rgba(255, 255, 255, 0.42);
}

.settings-content :deep(.text-input:focus),
.settings-content :deep(.hotkey-input:focus),
.settings-content :deep(input[type="text"]:focus),
.settings-content :deep(input[type="password"]:focus) {
  outline: none;
  border-color: rgba(255, 123, 182, 0.65);
  box-shadow: 0 0 0 3px rgba(255, 123, 182, 0.18), 0 12px 26px rgba(60, 72, 98, 0.1);
}

.settings-content :deep(input[type="checkbox"]),
.settings-content :deep(input[type="range"]) {
  accent-color: var(--accent);
}

.settings-content :deep(.setting-description),
.settings-content :deep(.about-item),
.settings-content :deep(.model-info-card),
.settings-content :deep(.motion-group),
.settings-content :deep(.model-card) {
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  box-shadow: 0 14px 34px rgba(60, 72, 98, 0.08);
}

.settings-container[data-theme="dark"] .settings-content :deep(.setting-description),
.settings-container[data-theme="dark"] .settings-content :deep(.about-item),
.settings-container[data-theme="dark"] .settings-content :deep(.model-info-card),
.settings-container[data-theme="dark"] .settings-content :deep(.motion-group),
.settings-container[data-theme="dark"] .settings-content :deep(.model-card) {
  background: rgba(10, 14, 26, 0.5);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.settings-content :deep(.about-item a) {
  color: #2a77ff;
}

.settings-content :deep(.model-tab) {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.95);
  color: rgba(43, 43, 51, 0.75);
}

.settings-container[data-theme="dark"] .settings-content :deep(.model-tab) {
  background: rgba(10, 14, 26, 0.55);
  border-color: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.68);
}

.settings-content :deep(.model-tab.active) {
  background: linear-gradient(135deg, rgba(255, 193, 222, 0.85), rgba(198, 220, 255, 0.85));
  border-color: rgba(255, 255, 255, 0.98);
  color: rgba(43, 43, 51, 0.92);
  box-shadow: 0 10px 22px rgba(70, 76, 96, 0.12);
}

.settings-container[data-theme="dark"] .settings-content :deep(.model-tab.active) {
  background: linear-gradient(135deg, rgba(255, 110, 199, 0.28), rgba(103, 183, 255, 0.24));
  border-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28);
}

.settings-content :deep(.current-badge) {
  background: rgba(255, 123, 182, 0.18);
  color: #c02757;
}

.settings-content :deep(.btn-preview),
.settings-content :deep(.btn-primary) {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}

.settings-content :deep(.btn-secondary) {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.95);
  color: rgba(43, 43, 51, 0.88);
}

.settings-content :deep(.btn-switch) {
  background: rgba(255, 255, 255, 0.9);
  color: rgba(43, 43, 51, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.95);
}

.settings-content :deep(.btn-delete) {
  color: #c02757;
  border-color: rgba(192, 39, 87, 0.35);
}

.settings-content :deep(.btn-delete:hover) {
  background: rgba(255, 123, 182, 0.14);
}

.settings-content :deep(.preview-toast.success) {
  background: var(--success);
}

.settings-content :deep(.preview-toast.error) {
  background: var(--danger);
}
</style>
