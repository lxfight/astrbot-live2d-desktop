<template>
  <div class="settings-about">
    <SettingsPageHeader
      immersive
      :page-key="`about-${appVersion}`"
      :title="APP_METADATA.displayName"
      :description="$t('settings.about.heroSubtitle')"
    >
      <template #extra>
        <p class="settings-about-hero-version">
          v{{ appVersion }} ·
          {{ $t('settings.about.protocolVersion', { version: protocolVersion }) }}
        </p>
      </template>
    </SettingsPageHeader>

    <div class="settings-about__stack settings-content-stagger">
      <section class="settings-section">
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

        <n-form label-placement="top" style="margin-top: 20px">
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
          <h2>{{ $t('settings.about.specialThanks') }}</h2>
        </div>

        <div class="link-stack">
          <button
            class="sponsor-button"
            type="button"
            @click="handleOpenLink('https://blog.futureppo.top')"
          >
            <div class="sponsor-button__content">
              <div class="sponsor-button__icon" aria-hidden="true">✦</div>
              <div class="sponsor-button__text">
                <div class="sponsor-button__name">Futureppo</div>
                <div class="sponsor-button__desc">{{ $t('settings.about.sponsorDesc') }}</div>
              </div>
            </div>
          </button>
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
          <button
            class="ghost-button"
            type="button"
            @click="handleOpenLink(APP_LINKS.adapterPlugin)"
          >
            {{ $t('settings.about.adapterPlugin') }}
          </button>
        </div>
      </section>

      <p class="settings-section__note">{{ $t('settings.about.poweredBy') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { APP_LINKS, APP_METADATA, PROTOCOL_VERSION } from '@/shared/metadata'
import SettingsPageHeader from '../shared/SettingsPageHeader.vue'
import { useAboutSettingsDomain } from '../domains/createAboutSettingsDomain'

const protocolVersion = PROTOCOL_VERSION

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
.settings-about {
  width: 100%;
}

.settings-about__stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.link-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sponsor-button {
  width: 100%;
  padding: 16px;
  border-radius: var(--desktop-radius-control);
  background: linear-gradient(
    135deg,
    rgba(var(--color-accent-rgb), 0.1) 0%,
    rgba(var(--color-accent-rgb), 0.04) 100%
  );
  border: 1px solid rgba(var(--color-accent-rgb), 0.22);
  color: var(--color-text-primary);
  transition: all var(--duration-fast) var(--ease-out);
  cursor: pointer;
}

.sponsor-button:hover {
  border-color: rgba(var(--color-accent-rgb), 0.4);
  transform: translateY(-2px);
  box-shadow: var(--settings-shadow);
}

.sponsor-button__content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sponsor-button__icon {
  font-size: 22px;
  line-height: 1;
  color: var(--color-accent);
}

.sponsor-button__text {
  flex: 1;
  text-align: left;
}

.sponsor-button__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 4px;
  letter-spacing: -0.02em;
}

.sponsor-button__desc {
  font-size: 12px;
  color: var(--color-text-tertiary);
  line-height: 1.4;
}

.ghost-button {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--desktop-radius-control);
  background: var(--settings-bg-surface);
  border: 1px solid var(--desktop-panel-border);
  color: var(--color-text-primary);
  font-size: 13px;
  transition: all var(--duration-fast) var(--ease-out);
  cursor: pointer;
}

.ghost-button:hover {
  background: var(--settings-bg-surface-hover);
  border-color: var(--desktop-panel-border-strong);
  transform: translateX(2px);
}
</style>
