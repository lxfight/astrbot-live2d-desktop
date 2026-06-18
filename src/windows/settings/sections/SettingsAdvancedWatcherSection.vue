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
      :title="$t('settings.advanced.watcher.awarenessTitle')"
      :description="$t('settings.advanced.watcher.awarenessDesc')"
    >
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.advanced.watcher.enableAwareness')">
          <n-switch v-model:value="draftConfig.enabled" />
        </n-form-item>

        <n-form-item :label="$t('settings.advanced.watcher.awarenessMode')">
          <n-radio-group v-model:value="draftConfig.mode" class="mode-group">
            <n-radio-button value="quiet">{{
              $t('settings.advanced.watcher.modeQuiet')
            }}</n-radio-button>
            <n-radio-button value="smart">{{
              $t('settings.advanced.watcher.modeSmart')
            }}</n-radio-button>
            <n-radio-button value="active">{{
              $t('settings.advanced.watcher.modeActive')
            }}</n-radio-button>
          </n-radio-group>
          <template #feedback>
            {{ modeDescription }}
          </template>
        </n-form-item>
      </n-form>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.watcher.appScope')"
      :description="$t('settings.advanced.watcher.appScopeDesc')"
    >
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.advanced.watcher.appScopeMode')">
          <n-radio-group v-model:value="draftConfig.appScope.mode">
            <n-space>
              <n-radio value="all">{{ $t('settings.advanced.watcher.scopeAll') }}</n-radio>
              <n-radio value="include">{{ $t('settings.advanced.watcher.scopeInclude') }}</n-radio>
              <n-radio value="exclude">{{ $t('settings.advanced.watcher.scopeExclude') }}</n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>

        <n-form-item
          v-if="draftConfig.appScope.mode !== 'all'"
          :label="$t('settings.advanced.watcher.scopeApps')"
        >
          <n-input
            v-model:value="appScopeInput"
            type="textarea"
            :rows="4"
            :placeholder="$t('settings.advanced.watcher.scopeAppsPlaceholder')"
            @update:value="updateAppScopeInput"
          />
          <template #feedback>
            {{ $t('settings.advanced.watcher.scopeAppsFeedback') }}
          </template>
        </n-form-item>
      </n-form>

      <div v-if="recentApps.length > 0" class="recent-apps">
        <div class="recent-apps__title">{{ $t('settings.advanced.watcher.recentApps') }}</div>
        <div class="recent-apps__list">
          <div v-for="item in recentApps" :key="item.app.canonicalKey" class="recent-app">
            <div class="recent-app__main">
              <strong>{{ item.app.displayName }}</strong>
              <span>{{ item.app.canonicalKey }}</span>
            </div>
            <n-space size="small">
              <n-button
                size="small"
                secondary
                @click="addAppToScope(item.app.canonicalKey, 'include')"
              >
                {{ $t('settings.advanced.watcher.addToInclude') }}
              </n-button>
              <n-button
                size="small"
                secondary
                @click="addAppToScope(item.app.canonicalKey, 'exclude')"
              >
                {{ $t('settings.advanced.watcher.addToExclude') }}
              </n-button>
              <n-button size="small" text @click="removeAppFromScope(item.app.canonicalKey)">
                {{ $t('settings.advanced.watcher.removeFromScope') }}
              </n-button>
            </n-space>
          </div>
        </div>
      </div>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.advanced.watcher.privacy')"
      :description="$t('settings.advanced.watcher.privacyDesc')"
    >
      <n-form label-placement="left">
        <n-form-item :label="$t('settings.advanced.watcher.shareWindowTitle')">
          <n-switch v-model:value="draftConfig.privacy.shareWindowTitle" />
        </n-form-item>
        <n-form-item :label="$t('settings.advanced.watcher.allowScreenshotOnRequest')">
          <n-switch v-model:value="draftConfig.privacy.allowScreenshotOnRequest" />
        </n-form-item>
      </n-form>
    </SettingsSubsection>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import SettingsSubsection from '../shared/SettingsSubsection.vue'
import { useWatcherSettingsDomain } from '../domains/createWatcherSettingsDomain'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const {
  appScopeInput,
  canSave,
  dirty,
  draftConfig,
  recentApps,
  resetDraft,
  resetPersisted,
  saveDraft,
  saving,
  addAppToScope,
  removeAppFromScope,
  updateAppScopeInput
} = useWatcherSettingsDomain()

const modeDescription = computed(() => {
  switch (draftConfig.value.mode) {
    case 'quiet':
      return t('settings.advanced.watcher.modeQuietDesc')
    case 'active':
      return t('settings.advanced.watcher.modeActiveDesc')
    case 'smart':
    default:
      return t('settings.advanced.watcher.modeSmartDesc')
  }
})
</script>

<style scoped>
.mode-group {
  display: flex;
  flex-wrap: wrap;
}

.recent-apps {
  margin-top: 8px;
}

.recent-apps__title {
  margin-bottom: 10px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.recent-apps__list {
  display: grid;
  gap: 8px;
}

.recent-app {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--settings-bg-muted);
}

.recent-app__main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.recent-app__main span {
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>
