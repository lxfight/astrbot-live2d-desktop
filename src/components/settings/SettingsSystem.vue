<template>
  <div class="settings-section">
    <h2>系统设置</h2>

    <div class="setting-item">
      <label>开机自启动</label>
      <input
        type="checkbox"
        v-model="settings.autoLaunch"
        @change="emit('save')"
        disabled
        title="暂未实现"
      />
      <span class="hint">暂未实现</span>
    </div>

    <div class="setting-item">
      <label>录音快捷键</label>
      <input
        type="text"
        v-model="settings.recordHotkey"
        @keydown="captureHotkey"
        placeholder="按下快捷键组合..."
        readonly
        :class="['hotkey-input', { 'hotkey-conflict': hotkeyConflict }]"
      />
      <span class="hint">按住快捷键录音，松开发送</span>
      <span v-if="hotkeyConflict" class="error-hint">快捷键冲突</span>
    </div>

    <div class="setting-description">
      <p><strong>录音快捷键：</strong>点击输入框后按下快捷键组合（如 Ctrl+T）来设置全局录音快捷键。</p>
      <p>支持的修饰键：Ctrl/Command、Shift、Alt</p>
      <p>支持的主键：A-Z、0-9、F1-F12</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AppSettings } from '../../composables/useSettings'

const props = defineProps<{
  settings: AppSettings
  hotkeyConflict: boolean
}>()

const emit = defineEmits<{
  (e: 'save'): void
  (e: 'update:hotkeyConflict', value: boolean): void
}>()

const captureHotkey = (event: KeyboardEvent) => {
  event.preventDefault()

  const keys: string[] = []

  if (event.ctrlKey || event.metaKey) {
    keys.push('CommandOrControl')
  }
  if (event.shiftKey) {
    keys.push('Shift')
  }
  if (event.altKey) {
    keys.push('Alt')
  }

  // 获取主键
  const mainKey = event.key.toUpperCase()
  if (mainKey.length === 1 && /[A-Z0-9]/.test(mainKey)) {
    keys.push(mainKey)
  } else if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(event.key)) {
    keys.push(event.key)
  }

  if (keys.length > 1) {
    emit('update:hotkeyConflict', false)
    props.settings.recordHotkey = keys.join('+')
    emit('save')
  }
}
</script>

<style scoped>
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
  gap: 8px;
}

.setting-item label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  min-width: 100px;
}

.setting-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.setting-item input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hotkey-input {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  min-width: 200px;
  cursor: pointer;
}

.hotkey-input:focus {
  outline: none;
  border-color: #4a9eff;
  background: rgba(255, 255, 255, 0.15);
}

.hotkey-input.hotkey-conflict {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.1);
}

.setting-item .hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.setting-item .error-hint {
  font-size: 12px;
  color: #ff4444;
  font-weight: 500;
}

.setting-description {
  margin-top: 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.setting-description p {
  margin: 8px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

.setting-description strong {
  color: rgba(255, 255, 255, 0.9);
}
</style>
