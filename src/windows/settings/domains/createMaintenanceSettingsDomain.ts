import { inject, type InjectionKey } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS } from '@/shared/metadata'
import type { ConnectionSettingsDomain } from './createConnectionSettingsDomain'
import type { AdvancedSettingsDomain } from './createAdvancedSettingsDomain'
import type { AboutSettingsDomain } from './createAboutSettingsDomain'
import type { WatcherSettingsDomain } from './createWatcherSettingsDomain'

export interface MaintenanceSettingsDomain {
  handleClearCache: () => void
  handleExportLogs: () => Promise<void>
  handleOpenLogs: () => Promise<void>
  handleResetSettings: () => void
}

export const maintenanceSettingsDomainKey: InjectionKey<MaintenanceSettingsDomain> = Symbol('maintenance-settings-domain')

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

export function createMaintenanceSettingsDomain(options: CreateMaintenanceSettingsDomainOptions): MaintenanceSettingsDomain {
  const {
    aboutDomain,
    advancedDomain,
    connectionDomain,
    dialog,
    message,
    watcherDomain,
  } = options

  async function handleOpenLogs() {
    const result = await window.electron.log.openDirectory()
    if (result.success) {
      message.success(`已打开日志目录: ${result.path}`)
      return
    }

    message.error(`打开日志目录失败: ${result.error || '未知错误'}`)
  }

  async function handleExportLogs() {
    const result = await window.electron.log.exportBundle(3)
    if (result.success) {
      message.success(`已导出 ${result.count} 个日志文件: ${result.path}`)
      return
    }

    message.error(`导出日志失败: ${result.error || '未知错误'}`)
  }

  function handleClearCache() {
    dialog.warning({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？',
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => {
        const preservedEntries = SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS
          .map((key) => [key, localStorage.getItem(key)] as const)

        localStorage.clear()

        for (const [key, value] of preservedEntries) {
          if (value !== null) {
            localStorage.setItem(key, value)
          }
        }

        message.success('缓存已清除')
      },
    })
  }

  function handleResetSettings() {
    dialog.error({
      title: '重置设置',
      content: '确定要重置所有设置吗？此操作不可恢复！',
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          localStorage.clear()

          await connectionDomain.resetToDefaults()
          await advancedDomain.resetAll()
          await aboutDomain.resetAll()
          await watcherDomain.resetPersisted()
          await window.electron.shortcut.unregister()
          await advancedDomain.checkShortcutRegistration(true)

          message.success('设置已重置')
        } catch (error: any) {
          message.error(`重置失败: ${error?.message || String(error)}`)
        }
      },
    })
  }

  return {
    handleClearCache,
    handleExportLogs,
    handleOpenLogs,
    handleResetSettings,
  }
}
