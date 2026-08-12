<template>
  <SettingsPageScaffold>
    <SettingsSubsection>
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.advanced.behavior.autoConnect')">
          <n-switch
            :value="connectionBehaviorSettings.autoConnectOnAppLaunch"
            @update:value="
              (value: boolean) =>
                updateConnectionBehaviorSettings({ autoConnectOnAppLaunch: value })
            "
          />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.resumeOnWake')">
          <n-switch
            :value="connectionBehaviorSettings.resumeDesiredConnectionOnWake"
            @update:value="
              (value: boolean) =>
                updateConnectionBehaviorSettings({ resumeDesiredConnectionOnWake: value })
            "
          />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.retryEnabled')">
          <n-switch
            :value="connectionBehaviorSettings.retryEnabled"
            @update:value="
              (value: boolean) => updateConnectionBehaviorSettings({ retryEnabled: value })
            "
          />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.retryBaseDelay')">
          <n-space align="center">
            <n-input-number
              :value="connectionBehaviorSettings.retryBaseDelayMs"
              :min="250"
              :max="300000"
              :step="250"
              :precision="0"
              @update:value="
                (value: number | null) =>
                  updateConnectionBehaviorSettings({ retryBaseDelayMs: value ?? 1000 })
              "
            />
            <span>{{ $t('settings.advanced.behavior.milliseconds') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.retryMaxDelay')">
          <n-space align="center">
            <n-input-number
              :value="connectionBehaviorSettings.retryMaxDelayMs"
              :min="250"
              :max="300000"
              :step="250"
              :precision="0"
              @update:value="
                (value: number | null) =>
                  updateConnectionBehaviorSettings({ retryMaxDelayMs: value ?? 30000 })
              "
            />
            <span>{{ $t('settings.advanced.behavior.milliseconds') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.retryMaxAttempts')">
          <n-space align="center">
            <n-input-number
              :value="connectionBehaviorSettings.retryMaxAttempts"
              :min="1"
              :max="1000"
              :precision="0"
              clearable
              :placeholder="$t('settings.advanced.behavior.retryUnlimited')"
              @update:value="
                (value: number | null) =>
                  updateConnectionBehaviorSettings({ retryMaxAttempts: value })
              "
            />
            <span>{{ $t('settings.advanced.behavior.times') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.handshakeTimeout')">
          <n-space align="center">
            <n-input-number
              :value="connectionBehaviorSettings.handshakeTimeoutMs"
              :min="1000"
              :max="60000"
              :step="500"
              :precision="0"
              @update:value="
                (value: number | null) =>
                  updateConnectionBehaviorSettings({ handshakeTimeoutMs: value ?? 8000 })
              "
            />
            <span>{{ $t('settings.advanced.behavior.milliseconds') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.recordingMode')">
          <n-radio-group
            v-model:value="advancedSettings.recordingMode"
            @update:value="applyAdvancedSettingChange"
          >
            <n-space>
              <n-radio-button value="hold">{{
                $t('settings.advanced.behavior.recordingModeHold')
              }}</n-radio-button>
              <n-radio-button value="toggle">{{
                $t('settings.advanced.behavior.recordingModeToggle')
              }}</n-radio-button>
            </n-space>
          </n-radio-group>
          <template #feedback>
            {{ $t('settings.advanced.behavior.recordingModeFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.autoLoadLastModel')">
          <n-switch
            v-model:value="advancedSettings.autoLoadLastModel"
            @update:value="applyAdvancedSettingChange"
          />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.silenceDetection')">
          <n-switch
            v-model:value="advancedSettings.silenceDetectionEnabled"
            @update:value="applyAdvancedSettingChange"
          />
          <template #feedback>
            {{ $t('settings.advanced.behavior.silenceDetectionFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.baseEventNotifications')">
          <n-switch
            v-model:value="advancedSettings.showBaseEventNotifications"
            @update:value="applyAdvancedSettingChange"
          />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.logLevel')">
          <n-radio-group
            v-model:value="advancedSettings.logLevel"
            @update:value="applyAdvancedSettingChange"
          >
            <n-space>
              <n-radio-button value="info">Info</n-radio-button>
              <n-radio-button value="debug">Debug</n-radio-button>
            </n-space>
          </n-radio-group>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.bubbleStackMax')">
          <n-space align="center">
            <n-input-number
              v-model:value="advancedSettings.bubbleStackMax"
              :min="1"
              :max="10"
              :precision="0"
              @update:value="applyAdvancedSettingChange"
            />
            <span>{{ $t('settings.advanced.behavior.bubbles') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.bubbleFollowUpWindow')">
          <n-space align="center">
            <n-input-number
              v-model:value="advancedSettings.bubbleFollowUpWindowMs"
              :min="500"
              :max="15000"
              :step="500"
              :precision="0"
              @update:value="applyAdvancedSettingChange"
            />
            <span>{{ $t('settings.advanced.behavior.milliseconds') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.imageInlineThreshold')">
          <n-space align="center">
            <n-input-number
              v-model:value="advancedSettings.imageInlineThresholdKb"
              :min="64"
              :max="2048"
              :step="64"
              :precision="0"
              @update:value="applyAdvancedSettingChange"
            />
            <span>{{ $t('settings.advanced.behavior.kb') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.imageMaxSize')">
          <n-space align="center">
            <n-input-number
              v-model:value="advancedSettings.imageMaxSizeMb"
              :min="1"
              :max="50"
              :step="1"
              :precision="0"
              @update:value="applyAdvancedSettingChange"
            />
            <span>{{ $t('settings.advanced.behavior.mb') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.screenshotTarget')">
          <n-radio-group
            :value="screenshotSettings.defaultTarget"
            @update:value="
              (value: 'active' | 'desktop') => updateScreenshotSettings({ defaultTarget: value })
            "
          >
            <n-space>
              <n-radio-button value="active">{{
                $t('settings.advanced.behavior.screenshotActiveWindow')
              }}</n-radio-button>
              <n-radio-button value="desktop">{{
                $t('settings.advanced.behavior.screenshotDesktop')
              }}</n-radio-button>
            </n-space>
          </n-radio-group>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.screenshotQuality')">
          <n-space align="center">
            <n-input-number
              :value="screenshotSettings.quality"
              :min="30"
              :max="100"
              :step="5"
              :precision="0"
              @update:value="
                (value: number | null) => updateScreenshotSettings({ quality: value ?? 80 })
              "
            />
            <span>{{ $t('settings.advanced.behavior.percent') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.screenshotMaxWidth')">
          <n-space align="center">
            <n-input-number
              :value="screenshotSettings.maxWidth"
              :min="640"
              :max="3840"
              :step="160"
              :precision="0"
              @update:value="
                (value: number | null) => updateScreenshotSettings({ maxWidth: value ?? 1920 })
              "
            />
            <span>{{ $t('settings.advanced.behavior.pixels') }}</span>
          </n-space>
        </n-form-item>
      </n-form>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.behavior.smartSection')"
      :description="$t('settings.advanced.behavior.smartSectionDesc')"
    >
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.advanced.behavior.idleRandomMotionEnabled')">
          <n-switch
            :value="advancedSettings.smartBehavior.idleRandomMotionEnabled"
            @update:value="updateSmartBehavior('idleRandomMotionEnabled', $event)"
          />
          <template #feedback>
            {{ $t('settings.advanced.behavior.idleRandomMotionEnabledFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.idleRandomMotionInterval')">
          <n-space align="center">
            <n-input-number
              :value="advancedSettings.smartBehavior.idleRandomMotionIntervalMin"
              :min="10"
              :max="300"
              :step="5"
              :precision="0"
              :disabled="!advancedSettings.smartBehavior.idleRandomMotionEnabled"
              @update:value="
                (value: number | null) =>
                  updateSmartBehavior('idleRandomMotionIntervalMin', value ?? 30)
              "
            />
            <span>{{ $t('settings.advanced.behavior.minutes') }}</span>
            <span style="color: var(--text-color-3)">—</span>
            <n-input-number
              :value="advancedSettings.smartBehavior.idleRandomMotionIntervalMax"
              :min="20"
              :max="600"
              :step="5"
              :precision="0"
              :disabled="!advancedSettings.smartBehavior.idleRandomMotionEnabled"
              @update:value="
                (value: number | null) =>
                  updateSmartBehavior('idleRandomMotionIntervalMax', value ?? 90)
              "
            />
            <span>{{ $t('settings.advanced.behavior.minutes') }}</span>
          </n-space>
          <template #feedback>
            {{ $t('settings.advanced.behavior.idleRandomMotionIntervalFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.idleTimeAwareness')">
          <n-switch
            :value="advancedSettings.smartBehavior.idleTimeAwarenessEnabled"
            @update:value="updateSmartBehavior('idleTimeAwarenessEnabled', $event)"
          />
          <template #feedback>
            {{ $t('settings.advanced.behavior.idleTimeAwarenessFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.remindersEnabled')">
          <n-switch
            :value="advancedSettings.smartBehavior.remindersEnabled"
            @update:value="updateSmartBehavior('remindersEnabled', $event)"
          />
          <template #feedback>
            {{ $t('settings.advanced.behavior.remindersEnabledFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.reminderSittingInterval')">
          <n-space align="center">
            <n-input-number
              :value="advancedSettings.smartBehavior.reminderSittingIntervalMinutes"
              :min="15"
              :max="240"
              :step="5"
              :precision="0"
              :disabled="!advancedSettings.smartBehavior.remindersEnabled"
              @update:value="
                (value: number | null) =>
                  updateSmartBehavior('reminderSittingIntervalMinutes', value ?? 60)
              "
            />
            <span>{{ $t('settings.advanced.behavior.minutes') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.reminderWaterInterval')">
          <n-space align="center">
            <n-input-number
              :value="advancedSettings.smartBehavior.reminderWaterIntervalMinutes"
              :min="15"
              :max="240"
              :step="5"
              :precision="0"
              :disabled="!advancedSettings.smartBehavior.remindersEnabled"
              @update:value="
                (value: number | null) =>
                  updateSmartBehavior('reminderWaterIntervalMinutes', value ?? 90)
              "
            />
            <span>{{ $t('settings.advanced.behavior.minutes') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.reminderEyeInterval')">
          <n-space align="center">
            <n-input-number
              :value="advancedSettings.smartBehavior.reminderEyeIntervalMinutes"
              :min="10"
              :max="240"
              :step="5"
              :precision="0"
              :disabled="!advancedSettings.smartBehavior.remindersEnabled"
              @update:value="
                (value: number | null) =>
                  updateSmartBehavior('reminderEyeIntervalMinutes', value ?? 45)
              "
            />
            <span>{{ $t('settings.advanced.behavior.minutes') }}</span>
          </n-space>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.focusPowerSave')">
          <n-switch
            :value="advancedSettings.smartBehavior.focusPowerSaveEnabled"
            @update:value="updateSmartBehavior('focusPowerSaveEnabled', $event)"
          />
          <template #feedback>
            {{ $t('settings.advanced.behavior.focusPowerSaveFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.focusPowerSaveDelay')">
          <n-space align="center">
            <n-input-number
              :value="advancedSettings.smartBehavior.focusPowerSaveDelaySeconds"
              :min="10"
              :max="600"
              :step="10"
              :precision="0"
              :disabled="!advancedSettings.smartBehavior.focusPowerSaveEnabled"
              @update:value="
                (value: number | null) =>
                  updateSmartBehavior('focusPowerSaveDelaySeconds', value ?? 60)
              "
            />
            <span>{{ $t('settings.advanced.behavior.seconds') }}</span>
          </n-space>
          <template #feedback>
            {{ $t('settings.advanced.behavior.focusPowerSaveDelayFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.focusPowerSaveFps')">
          <n-space align="center">
            <n-input-number
              :value="advancedSettings.smartBehavior.focusPowerSaveFps"
              :min="2"
              :max="30"
              :precision="0"
              :disabled="!advancedSettings.smartBehavior.focusPowerSaveEnabled"
              @update:value="
                (value: number | null) => updateSmartBehavior('focusPowerSaveFps', value ?? 5)
              "
            />
            <span>{{ $t('settings.advanced.behavior.fps') }}</span>
          </n-space>
          <template #feedback>
            {{ $t('settings.advanced.behavior.focusPowerSaveFpsFeedback') }}
          </template>
        </n-form-item>
      </n-form>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.behavior.desktopInteraction')"
      :description="$t('settings.advanced.behavior.desktopInteractionDesc')"
    >
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.advanced.behavior.alwaysOnTop')">
          <n-switch
            :value="desktopFeatureSettings.alwaysOnTop"
            @update:value="(value: boolean) => updateDesktopFeatureSetting('alwaysOnTop', value)"
          />
          <template #feedback>
            {{ $t('settings.advanced.behavior.alwaysOnTopFeedback') }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.passThroughMode')">
          <n-radio-group :value="passThroughMode" @update:value="handlePassThroughModeChange">
            <n-space vertical>
              <n-radio-button value="none">
                {{ $t('settings.advanced.behavior.passThroughNone') }}
              </n-radio-button>
              <n-radio-button
                value="dynamic"
                :disabled="!platformCapabilities?.mousePassthroughForward"
              >
                {{ $t('settings.advanced.behavior.passThroughDynamic') }}
              </n-radio-button>
              <n-radio-button value="full">
                {{ $t('settings.advanced.behavior.passThroughFull') }}
              </n-radio-button>
            </n-space>
          </n-radio-group>
          <template #feedback>
            {{ passThroughModeFeedback }}
          </template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.behavior.autoDetectFullscreen')">
          <n-switch
            :value="desktopFeatureSettings.autoDetectFullscreen"
            :disabled="!platformCapabilities?.gameMode.supported"
            @update:value="
              (value: boolean) => updateDesktopFeatureSetting('autoDetectFullscreen', value)
            "
          />
          <template #feedback>
            {{ $t('settings.advanced.behavior.autoDetectFullscreenFeedback') }}
          </template>
        </n-form-item>
      </n-form>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.behavior.platformCapabilities')"
      :description="$t('settings.advanced.behavior.platformCapabilitiesDesc')"
    >
      <div class="settings-kv-list">
        <div class="settings-kv-list__row">
          <span>{{ $t('settings.advanced.behavior.currentPlatform') }}</span>
          <strong>{{ platformDisplayName }}</strong>
        </div>
        <div class="settings-kv-list__row">
          <span>{{ $t('settings.advanced.behavior.gameModeLabel') }}</span>
          <strong>{{ gameModeCapabilityLabel }}</strong>
        </div>
        <div class="settings-kv-list__row">
          <span>{{ $t('settings.advanced.behavior.passThroughLabel') }}</span>
          <strong>{{ passThroughCapabilityLabel }}</strong>
        </div>
        <div class="settings-kv-list__row">
          <span>{{ $t('settings.advanced.behavior.alwaysOnTopLevelLabel') }}</span>
          <strong>{{ alwaysOnTopLevelLabel }}</strong>
        </div>
      </div>

      <n-alert
        v-if="platformCompatibilityNotice"
        :type="platformCompatibilityNotice.type"
        :show-icon="false"
      >
        {{ platformCompatibilityNotice.text }}
      </n-alert>
    </SettingsSubsection>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import SettingsSubsection from '../shared/SettingsSubsection.vue'
import { useAdvancedSettingsDomain } from '../domains/createAdvancedSettingsDomain'

const {
  advancedSettings,
  alwaysOnTopLevelLabel,
  applyAdvancedSettingChange,
  connectionBehaviorSettings,
  desktopFeatureSettings,
  gameModeCapabilityLabel,
  passThroughCapabilityLabel,
  platformCapabilities,
  platformCompatibilityNotice,
  platformDisplayName,
  screenshotSettings,
  updateConnectionBehaviorSettings,
  updateDesktopFeatureSetting,
  updateScreenshotSettings
} = useAdvancedSettingsDomain()

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

type PassThroughMode = 'none' | 'dynamic' | 'full'

type SmartBehaviorKey = keyof typeof advancedSettings.value.smartBehavior

function updateSmartBehavior(key: SmartBehaviorKey, value: boolean | number): void {
  advancedSettings.value.smartBehavior = {
    ...advancedSettings.value.smartBehavior,
    [key]: value
  }
  void applyAdvancedSettingChange()
}

const passThroughMode = computed<PassThroughMode>(() => {
  if (desktopFeatureSettings.value.fullPassThrough) return 'full'
  if (desktopFeatureSettings.value.dynamicPassThrough) return 'dynamic'
  return 'none'
})

const passThroughModeFeedback = computed(() => {
  switch (passThroughMode.value) {
    case 'dynamic':
      return t('settings.advanced.behavior.passThroughDynamicFeedback')
    case 'full':
      return t('settings.advanced.behavior.passThroughFullFeedback')
    default:
      return t('settings.advanced.behavior.passThroughNoneFeedback')
  }
})

function handlePassThroughModeChange(value: PassThroughMode) {
  switch (value) {
    case 'full':
      updateDesktopFeatureSetting('fullPassThrough', true)
      updateDesktopFeatureSetting('dynamicPassThrough', false)
      break
    case 'dynamic':
      updateDesktopFeatureSetting('fullPassThrough', false)
      updateDesktopFeatureSetting('dynamicPassThrough', true)
      break
    default:
      updateDesktopFeatureSetting('fullPassThrough', false)
      updateDesktopFeatureSetting('dynamicPassThrough', false)
      break
  }
}
</script>
