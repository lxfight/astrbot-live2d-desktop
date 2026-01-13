<template>
  <div class="settings-section">
    <h2>基础设置</h2>

    <div class="setting-item">
      <label>窗口置顶</label>
      <input
        type="checkbox"
        v-model="settings.alwaysOnTop"
        @change="emit('save')"
      />
    </div>

    <div class="setting-item">
      <label>透明窗口</label>
      <input
        type="checkbox"
        v-model="settings.transparent"
        @change="emit('save')"
        disabled
        title="需要重启应用生效"
      />
      <span class="hint">需要重启应用生效</span>
    </div>

    <div class="setting-item">
      <label>模型缩放</label>
      <input
        type="range"
        v-model.number="settings.modelScale"
        @change="emit('save')"
        min="0.5"
        max="2.0"
        step="0.1"
      />
      <span class="value">{{ settings.modelScale.toFixed(1) }}x</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AppSettings } from '../../composables/useSettings'

defineProps<{
  settings: AppSettings
}>()

const emit = defineEmits<{
  (e: 'save'): void
}>()
</script>

<style scoped>
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.setting-item label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.setting-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.setting-item input[type="range"] {
  flex: 1;
  margin: 0 16px;
  max-width: 300px;
}

.setting-item .value {
  min-width: 50px;
  text-align: right;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.setting-item .hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 8px;
}
</style>
