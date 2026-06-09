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
  </section>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useMaintenanceSettingsDomain } from '../domains/createMaintenanceSettingsDomain'

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()

const {
  handleClearCache,
  handleDownloadCubismCore,
  handleExportLogs,
  handleOpenLogs,
  handleResetSettings
} = useMaintenanceSettingsDomain()

async function handleExportConfig() {
  try {
    const result = await window.electron.config.export()
    if (result.success && result.filePath) {
      message.success(t('settings.advanced.data.exportConfigSuccess', { path: result.filePath }))
    } else if (result.canceled) {
      // 用户取消，不显示消息
    } else {
      message.error(t('settings.advanced.data.exportConfigFailed', { error: result.error }))
    }
  } catch (error) {
    message.error(
      t('settings.advanced.data.exportConfigFailed', {
        error: error instanceof Error ? error.message : String(error)
      })
    )
  }
}

async function handleImportConfig() {
  try {
    const result = await window.electron.config.import()

    if (result.canceled) {
      return
    }

    if (!result.success || !result.preview || !result.data) {
      message.error(t('settings.advanced.data.importConfigFailed', { error: result.error }))
      return
    }

    // 显示预览确认对话框
    const { preview } = result
    dialog.warning({
      title: t('settings.advanced.data.importConfigTitle'),
      content: t('settings.advanced.data.importConfigPreview', {
        exportedAt: new Date(preview.exportedAt).toLocaleString(),
        connectionSettings: preview.hasConnectionSettings ? t('common.yes') : t('common.no'),
        behaviorSettings: preview.hasConnectionBehaviorSettings ? t('common.yes') : t('common.no'),
        userConfigCount: preview.userConfigKeys.length,
        localStorageCount: preview.localStorageKeys.length
      }),
      positiveText: t('dialog.confirm'),
      negativeText: t('dialog.cancel'),
      onPositiveClick: async () => {
        try {
          const applyResult = await window.electron.config.applyImport(result.data)
          if (applyResult.success) {
            message.success(t('settings.advanced.data.importConfigSuccess'))
            // 建议重启应用
            setTimeout(() => {
              dialog.info({
                title: t('settings.advanced.data.restartRequired'),
                content: t('settings.advanced.data.restartRequiredDesc'),
                positiveText: t('dialog.confirm')
              })
            }, 500)
          } else {
            message.error(
              t('settings.advanced.data.importConfigFailed', { error: applyResult.error })
            )
          }
        } catch (error) {
          message.error(
            t('settings.advanced.data.importConfigFailed', {
              error: error instanceof Error ? error.message : String(error)
            })
          )
        }
      }
    })
  } catch (error) {
    message.error(
      t('settings.advanced.data.importConfigFailed', {
        error: error instanceof Error ? error.message : String(error)
      })
    )
  }
}
</script>
