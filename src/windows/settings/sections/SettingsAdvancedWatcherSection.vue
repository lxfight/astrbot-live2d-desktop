<template>
  <SettingsPageScaffold>
    <SettingsSubsection>
      <template #actions>
        <span class="status-pill" :class="dirty ? 'status-pill--warning' : 'status-pill--success'">
          {{
            dirty ? $t('settings.advanced.watcher.unsaved') : $t('settings.advanced.watcher.synced')
          }}
        </span>
      </template>
      <div class="settings-section__actions">
        <n-button :disabled="!dirty || saving" @click="resetDraft">{{
          $t('settings.advanced.watcher.discardChanges')
        }}</n-button>
        <n-button type="primary" :loading="saving" :disabled="!canSave" @click="saveDraft">{{
          $t('settings.advanced.watcher.saveChanges')
        }}</n-button>
        <n-button tertiary type="error" :loading="saving" @click="resetPersisted">{{
          $t('settings.advanced.watcher.resetDefault')
        }}</n-button>
      </div>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.watcher.basicSwitches')"
      :description="$t('settings.advanced.watcher.basicSwitchesDesc')"
    >
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.advanced.watcher.enableWatcher')">
          <n-switch v-model:value="draftConfig.enabled" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.enableAppLaunch')">
          <n-switch v-model:value="draftConfig.appLaunchEnabled" />
          <template #feedback>
            {{ $t('settings.advanced.watcher.appLaunchFeedback') }}
          </template>
        </n-form-item>
      </n-form>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.watcher.monitorFrequency')"
      :description="$t('settings.advanced.watcher.monitorFrequencyDesc')"
    >
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.advanced.watcher.globalInterval')">
          <n-input-number
            v-model:value="draftConfig.throttle.globalInterval"
            :min="0"
            :max="60000"
            :step="100"
            :placeholder="$t('settings.advanced.watcher.globalIntervalPlaceholder')"
          />
          <template #feedback>{{
            $t('settings.advanced.watcher.globalIntervalFeedback')
          }}</template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.perWindowInterval')">
          <n-input-number
            v-model:value="draftConfig.throttle.perWindowInterval"
            :min="0"
            :max="60000"
            :step="100"
            :placeholder="$t('settings.advanced.watcher.perWindowIntervalPlaceholder')"
          />
          <template #feedback>{{
            $t('settings.advanced.watcher.perWindowIntervalFeedback')
          }}</template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.minInterval')">
          <n-input-number
            v-model:value="draftConfig.throttle.minInterval"
            :min="0"
            :max="1000"
            :step="10"
            :placeholder="$t('settings.advanced.watcher.minIntervalPlaceholder')"
          />
          <template #feedback>{{ $t('settings.advanced.watcher.minIntervalFeedback') }}</template>
        </n-form-item>
      </n-form>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.watcher.monitorEvents')"
      :description="$t('settings.advanced.watcher.monitorEventsDesc')"
    >
      <n-form label-placement="left">
        <n-form-item :label="$t('settings.advanced.watcher.eventFocus')">
          <n-switch v-model:value="draftConfig.events.focus" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventBlur')">
          <n-switch v-model:value="draftConfig.events.blur" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventCreate')">
          <n-switch v-model:value="draftConfig.events.create" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventDestroy')">
          <n-switch v-model:value="draftConfig.events.destroy" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventFullscreen')">
          <n-switch v-model:value="draftConfig.events.fullscreen" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventWindowed')">
          <n-switch v-model:value="draftConfig.events.windowed" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventResize')">
          <n-switch v-model:value="draftConfig.events.resize" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventMove')">
          <n-switch v-model:value="draftConfig.events.move" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventMinimize')">
          <n-switch v-model:value="draftConfig.events.minimize" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventMaximize')">
          <n-switch v-model:value="draftConfig.events.maximize" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.eventRestore')">
          <n-switch v-model:value="draftConfig.events.restore" />
        </n-form-item>
      </n-form>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.watcher.aiResponseMode')"
      :description="$t('settings.advanced.watcher.aiResponseModeDesc')"
    >
      <n-radio-group v-model:value="draftConfig.aiResponse.mode">
        <n-space direction="vertical">
          <n-radio value="first-open">{{
            $t('settings.advanced.watcher.aiModeFirstOpen')
          }}</n-radio>
          <n-radio value="every-switch">{{
            $t('settings.advanced.watcher.aiModeEverySwitch')
          }}</n-radio>
          <n-radio value="specific-apps">{{
            $t('settings.advanced.watcher.aiModeSpecificApps')
          }}</n-radio>
        </n-space>
      </n-radio-group>

      <div v-if="draftConfig.aiResponse.mode === 'specific-apps'" class="specific-apps-config">
        <n-form-item :label="$t('settings.advanced.watcher.specificAppsList')">
          <n-input
            v-model:value="specificAppsInput"
            type="textarea"
            :rows="4"
            placeholder="chrome.exe&#10;firefox.exe&#10;code.exe"
            @update:value="updateSpecificApps"
          />
        </n-form-item>
      </div>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.watcher.ignoreRules')"
      :description="$t('settings.advanced.watcher.ignoreRulesDesc')"
    >
      <n-alert type="info" :show-icon="false" style="margin-bottom: 16px">
        <strong>{{ $t('settings.advanced.watcher.builtinRules') }}</strong>
        <div style="margin-top: 8px; font-size: 12px">
          {{ $t('settings.advanced.watcher.builtinRulesContent') }}
        </div>
      </n-alert>

      <n-form label-placement="top">
        <n-form-item :label="$t('settings.advanced.watcher.ignoreProcessNames')">
          <n-input
            v-model:value="ignoreProcessNamesInput"
            type="textarea"
            :rows="3"
            :placeholder="$t('settings.advanced.watcher.ignoreProcessNamesPlaceholder')"
            @update:value="updateIgnoreProcessNames"
          />
          <template #feedback>{{
            $t('settings.advanced.watcher.ignoreProcessNamesFeedback')
          }}</template>
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.ignoreTitleKeywords')">
          <n-input
            v-model:value="ignoreTitleKeywordsInput"
            type="textarea"
            :rows="3"
            :placeholder="$t('settings.advanced.watcher.ignoreTitleKeywordsPlaceholder')"
            @update:value="updateIgnoreTitleKeywords"
          />
          <template #feedback>{{
            $t('settings.advanced.watcher.ignoreTitleKeywordsFeedback')
          }}</template>
        </n-form-item>
      </n-form>
    </SettingsSubsection>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import SettingsSubsection from '../shared/SettingsSubsection.vue'
import { useWatcherSettingsDomain } from '../domains/createWatcherSettingsDomain'

const {
  canSave,
  dirty,
  draftConfig,
  ignoreProcessNamesInput,
  ignoreTitleKeywordsInput,
  resetDraft,
  resetPersisted,
  saveDraft,
  saving,
  specificAppsInput,
  updateIgnoreProcessNames,
  updateIgnoreTitleKeywords,
  updateSpecificApps
} = useWatcherSettingsDomain()
</script>

<style scoped>
.specific-apps-config {
  margin-top: 16px;
}
</style>
