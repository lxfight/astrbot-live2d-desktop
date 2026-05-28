<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.menu.connection.bridge') }}</h2>
      <span class="status-pill" :class="isConnected ? 'status-pill--success' : 'status-pill--warning'">
        {{ connectionStatusText }}
      </span>
    </div>

    <n-form label-placement="top">
      <n-form-item :label="$t('settings.connection.bridge.serverUrl')">
        <n-input v-model:value="serverUrl" placeholder="ws://127.0.0.1:9090/astrbot/live2d" />
      </n-form-item>
      <n-form-item :label="$t('settings.connection.bridge.token')">
        <n-input
          v-model:value="token"
          type="password"
          show-password-on="click"
          :placeholder="$t('settings.connection.bridge.tokenPlaceholder')"
        />
      </n-form-item>
    </n-form>

    <div class="settings-section__actions">
      <n-button
        type="primary"
        :loading="savingConnectionSettings"
        :disabled="!canConnect || !token.trim()"
        @click="handleSaveAndConnect"
      >
        {{ $t('settings.connection.bridge.saveAndConnect') }}
      </n-button>
      <n-button
        secondary
        :loading="savingConnectionSettings"
        :disabled="!hasUnsavedConnectionSettings"
        @click="handleSaveConnectionSettings"
      >
        {{ $t('settings.connection.bridge.saveConfig') }}
      </n-button>
      <n-button :disabled="!canConnect || !token.trim()" @click="handleConnect">
        {{ isConnected ? $t('settings.connection.bridge.connected') : $t('settings.connection.bridge.connect') }}
      </n-button>
      <n-button :disabled="!canDisconnect" @click="handleDisconnect">{{ $t('settings.connection.bridge.disconnect') }}</n-button>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.connection.bridge.resourceService') }}</h2>
    </div>

    <n-form label-placement="top">
      <n-form-item :label="$t('settings.connection.bridge.resourceServerUrl')">
        <n-input v-model:value="resourceServerUrl" :placeholder="$t('settings.connection.bridge.resourceServerUrlPlaceholder')" />
      </n-form-item>
      <n-form-item :label="$t('settings.connection.bridge.resourcePath')">
        <n-input v-model:value="resourceServerPath" :placeholder="$t('settings.connection.bridge.resourcePathPlaceholder')" />
      </n-form-item>
      <n-form-item :label="$t('settings.connection.bridge.resourceToken')">
        <n-input
          v-model:value="resourceAccessToken"
          type="password"
          show-password-on="click"
          :placeholder="$t('settings.connection.bridge.resourceTokenPlaceholder')"
        />
      </n-form-item>
    </n-form>
  </section>
</template>

<script setup lang="ts">
import { useConnectionSettingsDomain } from '../domains/createConnectionSettingsDomain'

const {
  canConnect,
  canDisconnect,
  connectionStatusText,
  handleConnect,
  handleDisconnect,
  handleSaveAndConnect,
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
