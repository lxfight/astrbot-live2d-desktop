<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.menu.advanced.data') }}</h2>
    </div>
    <p class="settings-section__desc">{{ $t('settings.advanced.data.description') }}</p>

    <div class="settings-section__actions">
      <n-button @click="handleOpenLogs">{{ $t('settings.advanced.data.openLogs') }}</n-button>
      <n-button @click="handleExportLogs">{{ $t('settings.advanced.data.exportLogs') }}</n-button>
      <n-button @click="handleDownloadCubismCore">{{
        $t('settings.advanced.data.downloadCubismCore')
      }}</n-button>
      <n-button @click="handleClearCache">{{ $t('settings.advanced.data.clearCache') }}</n-button>
      <n-button type="error" @click="handleResetSettings">{{
        $t('settings.advanced.data.resetSettings')
      }}</n-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useMaintenanceSettingsDomain } from '../domains/createMaintenanceSettingsDomain'

const {
  handleClearCache,
  handleDownloadCubismCore,
  handleExportLogs,
  handleOpenLogs,
  handleResetSettings
} = useMaintenanceSettingsDomain()
</script>
