<template>
  <div class="settings-section">
    <h2>WebSocket 设置</h2>

    <div class="setting-item">
      <label>服务器地址</label>
      <input
        type="text"
        v-model="settings.wsUrl"
        @change="emit('save')"
        placeholder="ws://localhost:8765/ws"
        class="text-input"
      />
    </div>

    <div class="setting-item">
      <label>连接令牌</label>
      <input
        type="password"
        v-model="settings.token"
        @change="emit('save')"
        placeholder="（可选）"
        class="text-input"
      />
    </div>

    <div class="setting-description">
      <p>WebSocket 用于与 AstrBot 服务器通信，接收消息和表演指令。</p>
      <p><strong>服务器地址：</strong>AstrBot 服务器的 WebSocket 地址</p>
      <p><strong>连接令牌：</strong>用于身份验证的令牌（如果服务器需要）</p>
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

.text-input {
  flex: 1;
  max-width: 400px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.text-input:focus {
  outline: none;
  border-color: #4a9eff;
  background: rgba(255, 255, 255, 0.15);
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
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
