<template>
  <SettingsPageScaffold>
    <template #headerExtra>
      <SettingsPageActions>
        <template #status>
          <span
            class="status-pill"
            :class="isConnected ? 'status-pill--success' : 'status-pill--warning'"
          >
            {{ connectionStatusText }}
          </span>
        </template>
        <n-button
          secondary
          :loading="savingConnectionSettings"
          :disabled="!hasUnsavedConnectionSettings"
          @click="handleSaveConnectionSettings"
        >
          <template #icon>
            <Save :size="15" />
          </template>
          {{ $t('settings.connection.bridge.saveConfig') }}
        </n-button>
        <n-button
          type="primary"
          :loading="savingConnectionSettings"
          :disabled="!canConnect || !token.trim()"
          @click="handleSaveAndConnect"
        >
          <template #icon>
            <Cable :size="15" />
          </template>
          {{ $t('settings.connection.bridge.saveAndConnect') }}
        </n-button>
      </SettingsPageActions>
    </template>

    <div class="settings-dashboard-columns">
      <SettingsSubsection :title="$t('settings.connection.bridge.serverUrl')">
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
          <n-button :disabled="!canConnect || !token.trim()" @click="handleConnect">
            {{
              isConnected
                ? $t('settings.connection.bridge.connected')
                : $t('settings.connection.bridge.connect')
            }}
          </n-button>
          <n-button :disabled="!canDisconnect" @click="handleDisconnect">{{
            $t('settings.connection.bridge.disconnect')
          }}</n-button>
        </div>
      </SettingsSubsection>

      <aside class="settings-dashboard-aside settings-section">
        <h3>{{ $t('settings.connection.bridge.asideTitle') }}</h3>
        <p>{{ $t('settings.page.connection.bridge.desc') }}</p>
        <div class="settings-dashboard-aside__actions">
          <n-button size="small" tertiary @click="copyServerUrl">{{
            $t('settings.connection.bridge.copyUrl')
          }}</n-button>
        </div>
      </aside>
    </div>

    <SettingsSubsection :title="$t('settings.connection.bridge.resourceService')">
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.connection.bridge.resourceServerUrl')">
          <n-input
            v-model:value="resourceServerUrl"
            :placeholder="$t('settings.connection.bridge.resourceServerUrlPlaceholder')"
          />
        </n-form-item>
        <n-form-item :label="$t('settings.connection.bridge.resourcePath')">
          <n-input
            v-model:value="resourceServerPath"
            :placeholder="$t('settings.connection.bridge.resourcePathPlaceholder')"
          />
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
    </SettingsSubsection>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { Cable, Save } from 'lucide-vue-next'
import SettingsPageActions from '../shared/SettingsPageActions.vue'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import SettingsSubsection from '../shared/SettingsSubsection.vue'
import { useConnectionSettingsDomain } from '../domains/createConnectionSettingsDomain'

const message = useMessage()
const { t } = useI18n()

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
  token
} = useConnectionSettingsDomain()

async function copyServerUrl() {
  if (!serverUrl.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(serverUrl.value)
    message.success(t('settings.connection.bridge.copyUrlSuccess'))
  } catch {
    message.error(t('settings.connection.bridge.copyUrlFailed'))
  }
}
</script>

<style scoped>
.settings-dashboard-columns {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 16px;
}

.settings-dashboard-aside {
  display: flex;
  flex-direction: column;
}

.settings-dashboard-aside h3 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-text-primary);
}

.settings-dashboard-aside p {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text-secondary);
}

.settings-dashboard-aside__actions {
  margin-top: auto;
  padding-top: 16px;
}

@media (max-width: 800px) {
  .settings-dashboard-columns {
    grid-template-columns: 1fr;
  }
}
</style>
