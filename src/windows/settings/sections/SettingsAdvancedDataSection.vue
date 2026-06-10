<template>
  <SettingsPageScaffold>
    <SettingsSubsection :title="$t('settings.advanced.data.storageTitle')">
      <div class="data-overview-toolbar">
        <n-button
          size="small"
          :loading="storageOverviewLoading"
          @click="ensureStorageOverviewReady(true)"
        >
          {{ $t('settings.advanced.data.refreshStorage') }}
        </n-button>
      </div>

      <n-skeleton v-if="storageOverviewLoading && !storageOverview" text :repeat="4" />

      <template v-else-if="storageOverview">
        <p class="data-overview-path">
          {{ $t('settings.advanced.data.appDataPath') }}: {{ storageOverview.appDataPath }}
          ·
          {{ $t(`settings.advanced.data.storageMode.${storageOverview.storageMode}`) }}
        </p>

        <div class="data-overview-grid">
          <div class="data-overview-card">
            <p class="data-overview-card__label">
              {{ $t('settings.advanced.data.metricDatabaseFile') }}
            </p>
            <p class="data-overview-card__value">
              {{ formatByteSize(storageOverview.databaseFileBytes) }}
            </p>
            <p class="data-overview-card__hint">
              {{
                $t('settings.advanced.data.metricDatabaseVersion', {
                  version: storageOverview.databaseVersion
                })
              }}
            </p>
          </div>

          <div class="data-overview-card">
            <p class="data-overview-card__label">
              {{ $t('settings.advanced.data.metricResourceBlob') }}
            </p>
            <p class="data-overview-card__value">
              {{ formatByteSize(storageOverview.resourceTotalBytes) }}
            </p>
            <p class="data-overview-card__hint">
              {{
                $t('settings.advanced.data.metricResourceCount', {
                  count: storageOverview.resourceCount
                })
              }}
            </p>
          </div>

          <div class="data-overview-card">
            <p class="data-overview-card__label">
              {{ $t('settings.advanced.data.metricModelsDir') }}
            </p>
            <p class="data-overview-card__value">
              {{ formatByteSize(storageOverview.modelsDirectoryBytes) }}
            </p>
            <p class="data-overview-card__hint">
              {{
                $t('settings.advanced.data.metricModelCount', {
                  count: storageOverview.modelLibraryCount
                })
              }}
            </p>
          </div>

          <div class="data-overview-card">
            <p class="data-overview-card__label">{{ $t('settings.advanced.data.metricLogs') }}</p>
            <p class="data-overview-card__value">
              {{ formatByteSize(storageOverview.logDirectoryBytes) }}
            </p>
            <p class="data-overview-card__hint">
              {{
                $t('settings.advanced.data.metricLogFiles', {
                  count: storageOverview.logFileCount
                })
              }}
            </p>
          </div>

          <div class="data-overview-card">
            <p class="data-overview-card__label">
              {{ $t('settings.advanced.data.metricCubismCore') }}
            </p>
            <p class="data-overview-card__value">
              {{
                storageOverview.cubismCoreInstalled
                  ? formatByteSize(storageOverview.cubismCoreBytes)
                  : $t('settings.advanced.data.cubismNotInstalled')
              }}
            </p>
          </div>

          <div class="data-overview-card">
            <p class="data-overview-card__label">
              {{ $t('settings.advanced.data.metricSessions') }}
            </p>
            <p class="data-overview-card__value">{{ storageOverview.sessionCount }}</p>
            <p class="data-overview-card__hint">
              {{
                $t('settings.advanced.data.metricMessageRows', {
                  count: storageOverview.messageCount
                })
              }}
            </p>
          </div>

          <div class="data-overview-card">
            <p class="data-overview-card__label">
              {{ $t('settings.advanced.data.metricPerformances') }}
            </p>
            <p class="data-overview-card__value">{{ storageOverview.performanceCount }}</p>
            <p class="data-overview-card__hint">
              {{
                $t('settings.advanced.data.metricPerformancesInterrupted', {
                  count: storageOverview.performanceInterruptedCount
                })
              }}
            </p>
          </div>

          <div class="data-overview-card">
            <p class="data-overview-card__label">
              {{ $t('settings.advanced.data.metricResourceDedup') }}
            </p>
            <p class="data-overview-card__value">
              {{ storageOverview.resourceDedupSha256Count }}
            </p>
          </div>
        </div>

        <div v-if="storageOverview.resourceBreakdown.length > 0" class="data-overview-breakdown">
          <p class="data-overview-card__label">
            {{ $t('settings.advanced.data.resourceBreakdownTitle') }}
          </p>
          <div
            v-for="item in storageOverview.resourceBreakdown"
            :key="item.mediaType"
            class="data-overview-breakdown__row"
          >
            <span class="data-overview-breakdown__type">{{ item.mediaType }}</span>
            <div class="data-overview-breakdown__bar">
              <div
                class="data-overview-breakdown__fill"
                :style="{ width: `${breakdownWidth(item.totalBytes)}%` }"
              />
            </div>
            <span class="data-overview-breakdown__meta">
              {{ item.count }} · {{ formatByteSize(item.totalBytes) }}
            </span>
          </div>
        </div>

        <p v-if="dataSpanLabel" class="data-overview-card__hint" style="margin-top: 12px">
          {{ $t('settings.advanced.data.dataSpan') }}: {{ dataSpanLabel }}
        </p>
      </template>
    </SettingsSubsection>

    <SettingsSubsection :title="$t('settings.advanced.data.actionsTitle')">
      <div class="settings-section__actions">
        <n-button @click="handleOpenLogs">{{ $t('settings.advanced.data.openLogs') }}</n-button>
        <n-button @click="handleExportLogs">{{ $t('settings.advanced.data.exportLogs') }}</n-button>
        <n-button @click="handleDownloadCubismCore">{{
          $t('settings.advanced.data.downloadCubismCore')
        }}</n-button>
        <n-button @click="handleExportConfig">{{
          $t('settings.advanced.data.exportConfig')
        }}</n-button>
        <n-button @click="handleImportConfig">{{
          $t('settings.advanced.data.importConfig')
        }}</n-button>
        <n-button @click="handleClearCache">{{ $t('settings.advanced.data.clearCache') }}</n-button>
        <n-button type="error" @click="handleResetSettings">{{
          $t('settings.advanced.data.resetSettings')
        }}</n-button>
      </div>
    </SettingsSubsection>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { format } from 'date-fns'
import { formatByteSize } from '@/utils/formatByteSize'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import SettingsSubsection from '../shared/SettingsSubsection.vue'
import { useMaintenanceSettingsDomain } from '../domains/createMaintenanceSettingsDomain'

const {
  ensureStorageOverviewReady,
  handleClearCache,
  handleDownloadCubismCore,
  handleExportConfig,
  handleExportLogs,
  handleImportConfig,
  handleOpenLogs,
  handleResetSettings,
  storageOverview,
  storageOverviewLoading
} = useMaintenanceSettingsDomain()

const maxBreakdownBytes = computed(() => {
  const rows = storageOverview.value?.resourceBreakdown ?? []
  return rows.reduce((max, row) => Math.max(max, row.totalBytes), 0)
})

const dataSpanLabel = computed(() => {
  const overview = storageOverview.value
  if (!overview?.earliestMessageTimestamp || !overview.latestMessageTimestamp) {
    return ''
  }

  const start = format(overview.earliestMessageTimestamp, 'yyyy-MM-dd')
  const end = format(overview.latestMessageTimestamp, 'yyyy-MM-dd')
  return `${start} — ${end}`
})

function breakdownWidth(bytes: number): number {
  const max = maxBreakdownBytes.value
  if (!max) {
    return 0
  }

  return Math.max(4, Math.round((bytes / max) * 100))
}
</script>

<style scoped lang="scss">
@use './settings-advanced-data.scss';
</style>
