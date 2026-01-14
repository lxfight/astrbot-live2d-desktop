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

.setting-item .hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 8px;
}
</style>
