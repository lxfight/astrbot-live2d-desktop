<template>
  <div class="settings-section">
    <h2>鼠标穿透设置</h2>

    <div class="setting-item">
      <label>启用智能穿透</label>
      <input
        type="checkbox"
        v-model="settings.passthroughEnabled"
        @change="emit('save')"
      />
    </div>

    <div class="setting-item" v-if="settings.passthroughEnabled">
      <label>Alpha 阈值</label>
      <input
        type="range"
        v-model.number="settings.alphaThreshold"
        @change="emit('save')"
        min="0"
        max="255"
        step="5"
      />
      <span class="value">{{ settings.alphaThreshold }}</span>
    </div>

    <div class="setting-item" v-if="settings.passthroughEnabled">
      <label>防抖延迟 (ms)</label>
      <input
        type="range"
        v-model.number="settings.debounceMs"
        @change="emit('save')"
        min="10"
        max="200"
        step="10"
      />
      <span class="value">{{ settings.debounceMs }}ms</span>
    </div>

    <div class="setting-description">
      <p>智能鼠标穿透功能可以让鼠标在透明区域穿透到桌面，在模型区域正常交互。</p>
      <p><strong>Alpha 阈值：</strong>像素透明度低于此值时启用穿透（0=完全透明，255=完全不透明）</p>
      <p><strong>防抖延迟：</strong>鼠标移动后延迟检测，避免频繁切换穿透状态</p>
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
