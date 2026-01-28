<template>
  <div class="settings-general">
    <!-- Window Settings -->
    <section class="settings-group">
      <h3 class="group-title">窗口行为</h3>
      
      <div class="setting-item">
        <div class="item-info">
          <label>窗口置顶</label>
          <span class="hint">窗口将始终保持在其他窗口之上</span>
        </div>
        <div class="control">
           <label class="switch">
            <input type="checkbox" v-model="settings.alwaysOnTop">
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <label>游戏模式</label>
          <span class="hint">检测到全屏应用时自动隐藏窗口</span>
        </div>
        <div class="control">
          <label class="switch">
            <input type="checkbox" v-model="settings.gameMode">
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div v-if="settings.gameMode" class="sub-settings">
        <div class="setting-item sub-item">
          <div class="item-info">
            <label>检测间隔</label>
            <span class="hint">全屏检测的频率</span>
          </div>
          <select v-model.number="settings.fullscreenHideTimeout" class="select-input">
            <option :value="1000">1 秒</option>
            <option :value="3000">3 秒</option>
            <option :value="5000">5 秒</option>
            <option :value="10000">10 秒</option>
          </select>
        </div>

        <div class="setting-item sub-item">
          <div class="item-info">
            <label>自动恢复</label>
            <span class="hint">退出全屏后自动显示窗口</span>
          </div>
          <label class="switch small">
            <input type="checkbox" v-model="settings.gameModeAutoRestore">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </section>

    <!-- Connection Settings -->
    <section class="settings-group">
      <h3 class="group-title">连接配置</h3>
      
      <div class="setting-item vertical">
        <div class="item-info">
          <label>服务器地址</label>
        </div>
        <input 
          type="text" 
          v-model="settings.wsUrl" 
          placeholder="ws://localhost:9090/astrbot/live2d"
          class="text-input"
          :class="{ invalid: !!errors?.wsUrl }"
        />
        <span v-if="errors?.wsUrl" class="error-msg">{{ errors.wsUrl }}</span>
      </div>

      <div class="setting-item vertical">
        <div class="item-info">
          <label>连接令牌</label>
        </div>
        <div class="input-with-action">
          <input 
            :type="showToken ? 'text' : 'password'" 
            v-model="settings.token" 
            placeholder="（可选）"
            class="text-input"
          />
          <button class="action-btn" @click="showToken = !showToken" :title="showToken ? '隐藏' : '显示'">
            <AppIcon :name="showToken ? 'eye-off' : 'eye'" :size="16" />
          </button>
        </div>
      </div>
    </section>

    <!-- System Settings -->
    <section class="settings-group">
      <h3 class="group-title">系统集成</h3>
      
      <div class="setting-item vertical">
        <div class="item-info">
          <label>全局录音快捷键</label>
          <span class="hint">按住快捷键说话，松开发送</span>
        </div>
        <input
          type="text"
          v-model="settings.recordHotkey"
          @keydown="captureHotkey"
          placeholder="点击设置快捷键 (如 Ctrl+T)"
          readonly
          class="text-input hotkey-input"
          :class="{ 'conflict': hotkeyConflict }"
        />
        <span v-if="hotkeyConflict" class="error-msg">快捷键冲突，请更换</span>
        <span v-else-if="errors?.recordHotkey" class="error-msg">{{ errors.recordHotkey }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { AppSettings } from '../../composables/useSettings'
import AppIcon from '../icons/AppIcon.vue'

const props = defineProps<{
  settings: AppSettings
  errors?: Record<string, string>
  hotkeyConflict?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:hotkeyConflict', value: boolean): void
}>()

const showToken = ref(false)

const captureHotkey = (event: KeyboardEvent) => {
  if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault()
    emit('update:hotkeyConflict', false)
    props.settings.recordHotkey = ''
    return
  }

  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return

  event.preventDefault()
  
  const keys: string[] = []
  if (event.ctrlKey || event.metaKey) keys.push('CommandOrControl')
  if (event.shiftKey) keys.push('Shift')
  if (event.altKey) keys.push('Alt')

  const mainKey = event.key.toUpperCase()
  if (/^[A-Z0-9]$/.test(mainKey) || /^F[1-9][0-2]?$/.test(event.key)) {
    keys.push(event.key)
  }

  if (keys.length > 1) {
    emit('update:hotkeyConflict', false)
    props.settings.recordHotkey = keys.join('+')
  }
}
</script>

<style scoped>
.settings-general {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-bottom: 32px;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 4px 0;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: border-color 0.2s;
}

.setting-item:hover {
  border-color: var(--border-hover);
}

.setting-item.vertical {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.sub-settings {
  margin-left: 20px;
  border-left: 2px solid var(--border-color);
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-item {
  background: transparent;
  border: none;
  padding: 8px 0;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-info label {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.item-info .hint {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Form Controls */
.text-input, .select-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  outline: none;
  transition: all 0.2s;
}

.text-input:focus, .select-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px var(--primary-color-alpha);
}

.text-input.invalid, .text-input.conflict {
  border-color: var(--danger-color);
}

.error-msg {
  font-size: 12px;
  color: var(--danger-color);
  margin-top: 4px;
}

.input-with-action {
  display: flex;
  gap: 8px;
}

.input-with-action input {
  flex: 1;
}

.action-btn {
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

/* Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--switch-off);
  transition: .3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: var(--surface-color);
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

input:checked + .slider {
  background-color: var(--primary-color);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

/* Small Switch */
.switch.small {
  width: 36px;
  height: 20px;
}

.switch.small .slider:before {
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
}

.switch.small input:checked + .slider:before {
  transform: translateX(16px);
}
</style>