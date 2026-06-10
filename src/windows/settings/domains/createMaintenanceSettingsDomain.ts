import { inject, type InjectionKey } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS } from '@/shared/metadata'
import type { ConnectionSettingsDomain } from './createConnectionSettingsDomain'
import type { AdvancedSettingsDomain } from './createAdvancedSettingsDomain'
import type { AboutSettingsDomain } from './createAboutSettingsDomain'
import type { WatcherSettingsDomain } from './createWatcherSettingsDomain'

export interface MaintenanceSettingsDomain {
  handleClearCache: () => void
  handleDownloadCubismCore: () => Promise<void>
  handleExportConfig: () => Promise<void>
  handleExportLogs: () => Promise<void>
  handleImportConfig: () => Promise<void>
  handleOpenLogs: () => Promise<void>
  handleResetSettings: () => void
}

export const maintenanceSettingsDomainKey: InjectionKey<MaintenanceSettingsDomain> = Symbol(
  'maintenance-settings-domain'
)

export function useMaintenanceSettingsDomain() {
  const domain = inject(maintenanceSettingsDomainKey)
  if (!domain) {
    throw new Error('MaintenanceSettingsDomain 未注入')
  }

  return domain
}

interface CreateMaintenanceSettingsDomainOptions {
  aboutDomain: AboutSettingsDomain
  advancedDomain: AdvancedSettingsDomain
  connectionDomain: ConnectionSettingsDomain
  dialog: DialogApi
  message: MessageApi
  watcherDomain: WatcherSettingsDomain
}

type DialogApi = ReturnType<typeof useDialog>
type MessageApi = ReturnType<typeof useMessage>

export function createMaintenanceSettingsDomain(
  options: CreateMaintenanceSettingsDomainOptions
): MaintenanceSettingsDomain {
  const { aboutDomain, advancedDomain, connectionDomain, dialog, message, watcherDomain } = options

  const { t } = useI18n()

  async function handleOpenLogs() {
    const result = await window.electron.log.openDirectory()
    if (result.success) {
      message.success(t('toast.logDirOpened', { path: result.path }))
      return
    }

    message.error(t('toast.logDirOpenFailed', { error: result.error || t('error.unknown') }))
  }

  async function handleExportLogs() {
    const result = await window.electron.log.exportBundle(3)
    if (result.success) {
      message.success(t('toast.logExported', { count: result.count, path: result.path }))
      return
    }

    message.error(t('toast.logExportFailed', { error: result.error || t('error.unknown') }))
  }

  function handleClearCache() {
    dialog.warning({
      title: t('settings.maintenance.clearCacheTitle'),
      content: t('settings.maintenance.clearCacheContent'),
      positiveText: t('dialog.confirm'),
      negativeText: t('dialog.cancel'),
      onPositiveClick: () => {
        const preservedEntries = SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS.map(
          key => [key, localStorage.getItem(key)] as const
        )

        localStorage.clear()

        for (const [key, value] of preservedEntries) {
          if (value !== null) {
            localStorage.setItem(key, value)
          }
        }

        message.success(t('toast.cacheCleared'))
      }
    })
  }

  function handleResetSettings() {
    dialog.error({
      title: t('settings.maintenance.resetSettingsTitle'),
      content: t('settings.maintenance.resetSettingsContent'),
      positiveText: t('dialog.confirm'),
      negativeText: t('dialog.cancel'),
      onPositiveClick: async () => {
        try {
          localStorage.clear()

          await connectionDomain.resetToDefaults()
          await advancedDomain.resetAll()
          await aboutDomain.resetAll()
          await watcherDomain.resetPersisted()
          await window.electron.shortcut.unregister()
          await advancedDomain.checkShortcutRegistration(true)

          message.success(t('toast.settingsReset'))
        } catch (error: any) {
          message.error(t('toast.settingsResetFailed', { error: error?.message || String(error) }))
        }
      }
    })
  }

  async function handleExportConfig() {
    try {
      const result = await window.electron.config.export()
      if (result.canceled) {
        return
      }
      if (result.success && result.filePath) {
        message.success(t('settings.advanced.data.exportConfigSuccess', { path: result.filePath }))
        return
      }
      message.error(
        t('settings.advanced.data.exportConfigFailed', {
          error: result.error || t('error.unknown')
        })
      )
    } catch (error: unknown) {
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
        message.error(
          t('settings.advanced.data.importConfigFailed', {
            error: result.error || t('error.unknown')
          })
        )
        return
      }

      const preview = result.preview
      dialog.warning({
        title: t('settings.advanced.data.importConfigTitle'),
        content: t('settings.advanced.data.importConfigPreview', {
          exportedAt: preview.exportedAt,
          connectionSettings: preview.hasConnectionSettings
            ? t('settings.about.enabled')
            : t('settings.about.disabled'),
          behaviorSettings: preview.hasConnectionBehaviorSettings
            ? t('settings.about.enabled')
            : t('settings.about.disabled'),
          userConfigCount: preview.userConfigKeys.length,
          localStorageCount: preview.localStorageKeys.length
        }),
        positiveText: t('dialog.confirm'),
        negativeText: t('dialog.cancel'),
        onPositiveClick: async () => {
          const applyResult = await window.electron.config.applyImport(result.data)
          if (applyResult.success) {
            message.success(t('settings.advanced.data.importConfigSuccess'))
            await connectionDomain.handleExternalSettingsChanged()
            return
          }
          message.error(
            t('settings.advanced.data.importConfigFailed', {
              error: applyResult.error || t('error.unknown')
            })
          )
        }
      })
    } catch (error: unknown) {
      message.error(
        t('settings.advanced.data.importConfigFailed', {
          error: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }

  async function handleDownloadCubismCore() {
    try {
      const result = await window.electron.window.downloadCubismCore()
      if (result.alreadyExists) {
        message.info(t('toast.cubismCoreAlreadyExists'))
        return
      }
      if (result.success) {
        message.success(t('toast.cubismCoreDownloadSuccess'))
        return
      }
      if (result.cancelled) {
        return
      }
      message.error(t('toast.cubismCoreDownloadFailed', { error: '' }))
    } catch (error: any) {
      message.error(t('toast.cubismCoreDownloadFailed', { error: error?.message || String(error) }))
    }
  }

  return {
    handleClearCache,
    handleDownloadCubismCore,
    handleExportConfig,
    handleExportLogs,
    handleImportConfig,
    handleOpenLogs,
    handleResetSettings
  }
}
