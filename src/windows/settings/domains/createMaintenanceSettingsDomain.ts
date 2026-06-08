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
  handleExportLogs: () => Promise<void>
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
    handleExportLogs,
    handleOpenLogs,
    handleResetSettings
  }
}
