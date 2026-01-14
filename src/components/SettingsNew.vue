<template>
  <div class="settings-container">
    <!-- 顶部栏 -->
    <header class="window-header">
      <div class="window-drag-bar">
        <div class="app-title">
          <span class="project-name">AstrBot Live2D Desktop</span>
          <span class="author">by lxfight</span>
        </div>
      </div>

      <!-- 右上角关闭按钮 -->
      <button @click="closeSettings" class="window-close-btn" title="关闭设置">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M 1,1 L 11,11 M 11,1 L 1,11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
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
        <div class="settings-content">
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

        <div class="settings-footer">
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
import ConversationHistory from './ConversationHistory.vue'
import StatisticsView from './StatisticsView.vue'

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
  await loadSettings()
})

const closeSettings = () => {
  window.close()
}
</script>

<style scoped>
.settings-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
}

.window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
  color: rgba(255, 255, 255, 0.9);
}

.author {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.window-close-btn {
  -webkit-app-region: no-drag;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.window-close-btn:hover {
  background: rgba(255, 0, 0, 0.2);
  color: #ff4444;
}

.settings-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.settings-sidebar {
  width: 200px;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.sidebar-nav {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.nav-item {
  width: 100%;
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
}

.nav-item.active {
  background: rgba(74, 158, 255, 0.1);
  color: #4a9eff;
  border-left-color: #4a9eff;
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-content {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 32px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
  padding: 8px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-primary {
  background: #4a9eff;
  color: white;
}

.btn-primary:hover {
  background: #3a8eef;
}

.save-success {
  position: fixed;
  top: 60px;
  right: 32px;
  padding: 12px 20px;
  background: rgba(76, 175, 80, 0.9);
  color: white;
  border-radius: 6px;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
</style>
