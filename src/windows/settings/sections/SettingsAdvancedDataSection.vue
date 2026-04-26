<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>数据管理</h2>
    </div>
    <p class="settings-section__desc">管理应用缓存、日志和设置数据。</p>

    <div class="settings-section__actions">
      <n-button @click="handleOpenLogs">打开日志目录</n-button>
      <n-button @click="handleExportLogs">导出最近日志</n-button>
      <n-button @click="handleClearCache">清除缓存</n-button>
      <n-button type="error" @click="handleResetSettings">重置所有设置</n-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useMaintenanceSettingsDomain } from '../domains/createMaintenanceSettingsDomain'

const { handleClearCache, handleExportLogs, handleOpenLogs, handleResetSettings } = useMaintenanceSettingsDomain()
</script>
