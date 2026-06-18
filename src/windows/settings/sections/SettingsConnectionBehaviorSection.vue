<template>
  <SettingsPageScaffold>
    <template #headerExtra>
      <SettingsPageActions>
        <n-button :disabled="!hasChanges" @click="handleReset">
          <template #icon>
            <Undo2 :size="15" />
          </template>
          {{ $t('settings.connection.behavior.cancel') }}
        </n-button>
        <n-button type="primary" :loading="saving" :disabled="!hasChanges" @click="handleSave">
          <template #icon>
            <Save :size="15" />
          </template>
          {{ $t('settings.connection.behavior.save') }}
        </n-button>
      </SettingsPageActions>
    </template>

    <SettingsSubsection>
      <n-form label-placement="top">
        <n-form-item>
          <template #label>
            <div class="form-label-with-tag">
              {{ $t('settings.connection.behavior.autoConnectOnAppLaunch') }}
              <n-tag v-if="!behaviorSettings.autoConnectOnAppLaunch" size="small" type="warning">
                {{ $t('settings.about.disabled') }}
              </n-tag>
            </div>
          </template>
          <n-switch v-model:value="behaviorSettings.autoConnectOnAppLaunch" />
          <template #feedback>
            {{ $t('settings.connection.behavior.autoConnectOnAppLaunchDesc') }}
          </template>
        </n-form-item>

        <n-form-item>
          <template #label>
            <div class="form-label-with-tag">
              {{ $t('settings.connection.behavior.resumeDesiredConnectionOnWake') }}
              <n-tag
                v-if="!behaviorSettings.resumeDesiredConnectionOnWake"
                size="small"
                type="warning"
              >
                {{ $t('settings.about.disabled') }}
              </n-tag>
            </div>
          </template>
          <n-switch v-model:value="behaviorSettings.resumeDesiredConnectionOnWake" />
          <template #feedback>
            {{ $t('settings.connection.behavior.resumeDesiredConnectionOnWakeDesc') }}
          </template>
        </n-form-item>

        <n-form-item>
          <template #label>
            <div class="form-label-with-tag">
              {{ $t('settings.connection.behavior.retryEnabled') }}
              <n-tag v-if="!behaviorSettings.retryEnabled" size="small" type="warning">
                {{ $t('settings.about.disabled') }}
              </n-tag>
            </div>
          </template>
          <n-switch v-model:value="behaviorSettings.retryEnabled" />
          <template #feedback>
            {{ $t('settings.connection.behavior.retryEnabledDesc') }}
          </template>
        </n-form-item>

        <n-form-item :label="$t('settings.connection.behavior.retryBaseDelayMs')">
          <div class="slider-container">
            <n-slider
              v-model:value="behaviorSettings.retryBaseDelayMs"
              :min="250"
              :max="10000"
              :step="250"
              :disabled="!behaviorSettings.retryEnabled"
            />
            <span class="slider-value">{{ formatDelay(behaviorSettings.retryBaseDelayMs) }}</span>
            <n-button
              v-if="behaviorSettings.retryBaseDelayMs !== 1000"
              text
              size="small"
              @click="behaviorSettings.retryBaseDelayMs = 1000"
            >
              {{ $t('settings.connection.behavior.reset') }}
            </n-button>
          </div>
          <template #feedback>
            {{ $t('settings.connection.behavior.retryBaseDelayMsDesc') }}
          </template>
        </n-form-item>

        <n-form-item :label="$t('settings.connection.behavior.retryMaxDelayMs')">
          <div class="slider-container">
            <n-slider
              v-model:value="behaviorSettings.retryMaxDelayMs"
              :min="1000"
              :max="60000"
              :step="1000"
              :disabled="!behaviorSettings.retryEnabled"
            />
            <span class="slider-value">{{ formatDelay(behaviorSettings.retryMaxDelayMs) }}</span>
            <n-button
              v-if="behaviorSettings.retryMaxDelayMs !== 30000"
              text
              size="small"
              @click="behaviorSettings.retryMaxDelayMs = 30000"
            >
              {{ $t('settings.connection.behavior.reset') }}
            </n-button>
          </div>
          <template #feedback>
            {{ $t('settings.connection.behavior.retryMaxDelayMsDesc') }}
          </template>
        </n-form-item>

        <n-form-item :label="$t('settings.connection.behavior.retryMaxAttempts')">
          <div class="retry-attempts">
            <div class="slider-container">
              <n-switch
                :value="behaviorSettings.retryMaxAttempts !== null"
                :disabled="!behaviorSettings.retryEnabled"
                @update:value="handleToggleMaxAttempts"
              />
              <span class="slider-label">
                {{
                  behaviorSettings.retryMaxAttempts === null
                    ? $t('settings.connection.behavior.unlimited')
                    : $t('settings.connection.behavior.limited')
                }}
              </span>
            </div>
            <div v-if="behaviorSettings.retryMaxAttempts !== null" class="slider-container">
              <n-slider
                v-model:value="behaviorSettings.retryMaxAttempts"
                :min="1"
                :max="100"
                :step="1"
                :disabled="!behaviorSettings.retryEnabled"
              />
              <span class="slider-value">{{ behaviorSettings.retryMaxAttempts }}</span>
            </div>
          </div>
          <template #feedback>
            {{ $t('settings.connection.behavior.retryMaxAttemptsDesc') }}
          </template>
        </n-form-item>

        <n-form-item :label="$t('settings.connection.behavior.handshakeTimeoutMs')">
          <div class="slider-container">
            <n-slider
              v-model:value="behaviorSettings.handshakeTimeoutMs"
              :min="1000"
              :max="60000"
              :step="1000"
            />
            <span class="slider-value">{{ formatDelay(behaviorSettings.handshakeTimeoutMs) }}</span>
            <n-button
              v-if="behaviorSettings.handshakeTimeoutMs !== 8000"
              text
              size="small"
              @click="behaviorSettings.handshakeTimeoutMs = 8000"
            >
              {{ $t('settings.connection.behavior.reset') }}
            </n-button>
          </div>
          <template #feedback>
            {{ $t('settings.connection.behavior.handshakeTimeoutMsDesc') }}
          </template>
        </n-form-item>
      </n-form>
    </SettingsSubsection>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Save, Undo2 } from 'lucide-vue-next'
import SettingsPageActions from '../shared/SettingsPageActions.vue'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import SettingsSubsection from '../shared/SettingsSubsection.vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import type { ConnectionBehaviorSettingsPersistedV1 } from '@/shared/connectionBehaviorSettings'
import { buildDefaultConnectionBehaviorSettings } from '@/shared/connectionBehaviorSettings'

const { t } = useI18n()
const message = useMessage()

const originalSettings = ref<ConnectionBehaviorSettingsPersistedV1>(
  buildDefaultConnectionBehaviorSettings()
)
const behaviorSettings = ref<ConnectionBehaviorSettingsPersistedV1>(
  buildDefaultConnectionBehaviorSettings()
)
const saving = ref(false)

const hasChanges = computed(() => {
  return JSON.stringify(behaviorSettings.value) !== JSON.stringify(originalSettings.value)
})

function formatDelay(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

function handleToggleMaxAttempts(enabled: boolean) {
  behaviorSettings.value.retryMaxAttempts = enabled ? 10 : null
}

function handleReset() {
  behaviorSettings.value = { ...originalSettings.value }
}

async function handleSave() {
  saving.value = true
  try {
    const result = await window.electron.connectionBehaviorSettings.save({
      data: behaviorSettings.value
    })

    if (result.success) {
      originalSettings.value = { ...result.data }
      behaviorSettings.value = { ...result.data }
      message.success(t('settings.connection.behavior.saveSuccess'))
    } else {
      message.error(t('settings.connection.behavior.saveFailed', { error: result.message }))
    }
  } catch (error) {
    console.error('[连接行为设置] 保存失败:', error)
    message.error(
      t('settings.connection.behavior.saveFailed', {
        error: error instanceof Error ? error.message : String(error)
      })
    )
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const result = await window.electron.connectionBehaviorSettings.load()
    if (result.success) {
      originalSettings.value = { ...result.data }
      behaviorSettings.value = { ...result.data }
    }
  } catch (error) {
    console.error('[连接行为设置] 加载失败:', error)
  }
})
</script>

<style scoped>
.form-label-with-tag {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.slider-container > :first-child {
  flex: 1;
  min-width: 0;
}

.slider-value {
  min-width: 56px;
  text-align: right;
  font-size: 13px;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.slider-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.retry-attempts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
</style>
