<template>
  <div class="settings-section">
    <h2>交互设置</h2>

    <div class="setting-item">
      <label>视线跟随</label>
      <input
        type="checkbox"
        v-model="settings.eyeTracking"
        @change="emit('save')"
      />
      <span class="hint">模型视线跟随鼠标移动</span>
    </div>

    <div class="setting-item">
      <label>点击反馈</label>
      <input
        type="checkbox"
        v-model="settings.clickFeedback"
        @change="emit('save')"
      />
      <span class="hint">点击模型时播放动作</span>
    </div>

    <div class="setting-item">
      <label>拖拽移动</label>
      <input
        type="checkbox"
        v-model="settings.dragEnabled"
        @change="emit('save')"
      />
      <span class="hint">允许拖拽模型移动窗口</span>
    </div>

    <div class="setting-description">
      <p>交互设置控制模型的响应行为：</p>
      <ul>
        <li><strong>视线跟随：</strong>模型的眼睛会跟随鼠标指针移动</li>
        <li><strong>点击反馈：</strong>点击模型时会播放随机动作作为反馈</li>
        <li><strong>拖拽移动：</strong>长按模型可以拖拽移动整个窗口位置</li>
      </ul>
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
  min-width: 100px;
}

.setting-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.setting-item .hint {
  flex: 1;
  margin-left: 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
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

.setting-description ul {
  margin: 12px 0;
  padding-left: 24px;
}

.setting-description li {
  margin: 8px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

.setting-description strong {
  color: rgba(255, 255, 255, 0.9);
}
</style>
