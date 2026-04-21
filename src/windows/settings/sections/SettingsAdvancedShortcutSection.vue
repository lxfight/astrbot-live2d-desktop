<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>快捷键</h2>
    </div>
    <p class="settings-section__desc">配置全局录音快捷键和录音时长限制。</p>

    <n-form label-placement="top">
      <n-form-item label="全局录音快捷键">
        <div class="shortcut-row">
          <n-input
            v-model:value="advancedSettings.recordingShortcut"
            placeholder="按下快捷键..."
            readonly
            @keydown="handleShortcutKeyDown"
          />
          <n-button @click="handleClearShortcut">清除</n-button>
          <n-button type="primary" @click="handleRegisterShortcut">
            {{ shortcutRegistered ? '已注册' : '注册' }}
          </n-button>
        </div>
      </n-form-item>
      <n-form-item label="最长录音时长">
        <n-space align="center">
          <n-input-number
            v-model:value="recordingSecondsValue"
            :min="1"
            :max="60"
            :precision="0"
            @update:value="applyAdvancedSettingChange"
          />
          <span>秒（上限 60 秒）</span>
        </n-space>
      </n-form-item>
    </n-form>
  </section>
</template>

<script setup lang="ts">
import { useAdvancedSettingsDomain } from '../domains/createAdvancedSettingsDomain'

const {
  advancedSettings,
  applyAdvancedSettingChange,
  handleClearShortcut,
  handleRegisterShortcut,
  handleShortcutKeyDown,
  recordingSecondsValue,
  shortcutRegistered,
} = useAdvancedSettingsDomain()
</script>

<style scoped>
.shortcut-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.shortcut-row :deep(.n-input) {
  flex: 1 1 200px;
}
</style>
