<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>Bridge 连接</h2>
      <span class="status-pill" :class="isConnected ? 'status-pill--success' : 'status-pill--warning'">
        {{ isConnected ? '已连接' : '未连接' }}
      </span>
    </div>
    <p class="settings-section__desc">连接到 AstrBot Bridge 以控制 Live2D 模型和接收消息。</p>

    <n-form label-placement="top">
      <n-form-item label="服务器地址">
        <n-input v-model:value="serverUrl" placeholder="ws://127.0.0.1:9090/astrbot/live2d" />
      </n-form-item>
      <n-form-item label="认证令牌">
        <n-input
          v-model:value="token"
          type="password"
          show-password-on="click"
          placeholder="必填，需与 AstrBot 适配器 auth_token 一致"
        />
      </n-form-item>
    </n-form>

    <div class="settings-section__actions">
      <n-button
        type="primary"
        secondary
        :loading="savingConnectionSettings"
        :disabled="!hasUnsavedConnectionSettings"
        @click="handleSaveConnectionSettings"
      >
        保存连接配置
      </n-button>
      <n-button type="primary" :disabled="isConnected || !token.trim()" @click="handleConnect">
        {{ isConnected ? '已连接' : '连接服务器' }}
      </n-button>
      <n-button :disabled="!isConnected" @click="handleDisconnect">断开连接</n-button>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>资源服务</h2>
    </div>
    <p class="settings-section__desc">配置图片、音频、视频等资源的访问地址。默认复用 WebSocket 连接地址。</p>

    <n-form label-placement="top">
      <n-form-item label="资源服务地址">
        <n-input v-model:value="resourceServerUrl" placeholder="留空时自动跟随连接地址" />
      </n-form-item>
      <n-form-item label="资源路径">
        <n-input v-model:value="resourceServerPath" placeholder="默认沿用握手路径或 /resources" />
      </n-form-item>
      <n-form-item label="资源访问令牌">
        <n-input
          v-model:value="resourceAccessToken"
          type="password"
          show-password-on="click"
          placeholder="留空时复用 WebSocket 认证令牌"
        />
      </n-form-item>
    </n-form>
  </section>
</template>

<script setup lang="ts">
import { useConnectionSettingsDomain } from '../domains/createConnectionSettingsDomain'

const {
  handleConnect,
  handleDisconnect,
  handleSaveConnectionSettings,
  hasUnsavedConnectionSettings,
  isConnected,
  resourceAccessToken,
  resourceServerPath,
  resourceServerUrl,
  savingConnectionSettings,
  serverUrl,
  token,
} = useConnectionSettingsDomain()
</script>
