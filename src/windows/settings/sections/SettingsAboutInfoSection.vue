<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.about.title') }}</h2>
    </div>

    <div class="settings-kv-list">
      <div class="settings-kv-list__row">
        <span>{{ $t('settings.about.appName') }}</span>
        <strong>{{ APP_METADATA.displayName }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>{{ $t('settings.about.version') }}</span>
        <strong>v{{ appVersion }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>{{ $t('settings.about.updateStatus') }}</span>
        <strong>{{ updateStatusLabel }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>{{ $t('settings.about.autoCheckUpdate') }}</span>
        <strong>{{
          updaterSettings.autoUpdateEnabled
            ? $t('settings.about.enabled')
            : $t('settings.about.disabled')
        }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>{{ $t('settings.about.author') }}</span>
        <strong>{{ APP_METADATA.authorName }}</strong>
      </div>
    </div>

    <n-form label-placement="top" style="margin-top: 16px">
      <n-form-item :label="$t('settings.about.language')">
        <n-select
          :value="localeStore.locale"
          :options="languageOptions"
          style="width: 160px"
          @update:value="handleLocaleChange"
        />
      </n-form-item>
      <n-form-item :label="$t('settings.about.autoCheckUpdate')">
        <n-switch
          :value="updaterSettings.autoUpdateEnabled"
          @update:value="updateAutoUpdateSetting"
        />
        <template #feedback>
          {{ $t('settings.about.autoCheckDesc') }}
        </template>
      </n-form-item>
    </n-form>

    <div class="settings-section__actions">
      <n-button :loading="checkingUpdate" @click="handleCheckUpdates">{{
        $t('settings.about.checkUpdate')
      }}</n-button>
      <n-button v-if="canInstallUpdate" type="primary" @click="handleInstallUpdate">{{
        $t('settings.about.restartAndInstall')
      }}</n-button>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.about.relatedProjects') }}</h2>
    </div>

    <div class="link-stack">
      <button class="ghost-button" type="button" @click="handleOpenLink(APP_LINKS.astrbot)">
        AstrBot
      </button>
      <button class="ghost-button" type="button" @click="handleOpenLink(APP_LINKS.repository)">
        {{ $t('settings.about.projectRepo') }}
      </button>
      <button class="ghost-button" type="button" @click="handleOpenLink(APP_LINKS.adapterPlugin)">
        {{ $t('settings.about.adapterPlugin') }}
      </button>
    </div>
  </section>

  <section class="settings-section">
    <p class="settings-section__note">{{ $t('settings.about.poweredBy') }}</p>
  </section>
</template>

<script setup lang="ts">
import { APP_LINKS, APP_METADATA } from '@/shared/metadata'
import { useLocaleStore } from '@/stores/locale'
import { useAboutSettingsDomain } from '../domains/createAboutSettingsDomain'

const localeStore = useLocaleStore()

const languageOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en' }
]

function handleLocaleChange(value: string) {
  if (value === 'zh-CN' || value === 'en') {
    localeStore.setLocale(value)
    window.electron.locale.set(value)
  }
}

const {
  appVersion,
  canInstallUpdate,
  checkingUpdate,
  handleCheckUpdates,
  handleInstallUpdate,
  handleOpenLink,
  updateAutoUpdateSetting,
  updateStatusLabel,
  updaterSettings
} = useAboutSettingsDomain()
</script>

<style scoped>
.link-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ghost-button {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--desktop-radius-control);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--desktop-panel-border);
  color: var(--color-text-primary);
  font-size: 13px;
  transition: all var(--duration-fast) var(--ease-out);
}

.ghost-button:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--desktop-panel-border-strong);
}
</style>
