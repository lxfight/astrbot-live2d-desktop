import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { DEFAULT_UPDATER_SETTINGS } from '@/utils/updaterSettings'
import { createDeferredTaskCache } from '../composables/createDeferredTaskCache'

export interface AboutSettingsDomain {
  appVersion: Ref<string>
  applyUpdateState: (state: UpdateState) => void
  canInstallUpdate: ComputedRef<boolean>
  checkingUpdate: Ref<boolean>
  ensureReady: (force?: boolean) => Promise<void>
  handleCheckUpdates: () => Promise<void>
  handleInstallUpdate: () => Promise<void>
  handleOpenLink: (url: string) => void
  resetAll: () => Promise<void>
  updateAutoUpdateSetting: (value: boolean) => Promise<void>
  updateState: Ref<UpdateState | null>
  updateStatusLabel: ComputedRef<string>
  updaterSettings: Ref<{ autoUpdateEnabled: boolean }>
}

export const aboutSettingsDomainKey: InjectionKey<AboutSettingsDomain> = Symbol('about-settings-domain')

export function useAboutSettingsDomain() {
  const domain = inject(aboutSettingsDomainKey)
  if (!domain) {
    throw new Error('AboutSettingsDomain 未注入')
  }

  return domain
}

type MessageApi = ReturnType<typeof useMessage>

export function createAboutSettingsDomain(message: MessageApi): AboutSettingsDomain {
  const appVersion = ref('')
  const checkingUpdate = ref(false)
  const updateState = ref<UpdateState | null>(null)
  const updaterSettings = ref({
    autoUpdateEnabled: Boolean(DEFAULT_UPDATER_SETTINGS.autoUpdateEnabled),
  })

  const taskCache = createDeferredTaskCache()

  const updateStatusLabel = computed(() => {
    if (!updateState.value) return '更新状态未知'
    if (updateState.value.status === 'downloading' && typeof updateState.value.progress === 'number') {
      return `${updateState.value.message}（${Math.round(updateState.value.progress)}%）`
    }
    return updateState.value.message
  })
  const canInstallUpdate = computed(() => updateState.value?.status === 'downloaded')

  async function loadAppVersion() {
    appVersion.value = await window.electron.window.getAppVersion()
  }

  async function loadUpdateState() {
    try {
      updateState.value = await window.electron.update.getState()
    } catch {
      updateState.value = null
    }
  }

  async function loadUpdaterSettings() {
    const settings = await window.electron.update.getSettings()
    updaterSettings.value = {
      autoUpdateEnabled: Boolean(settings.autoUpdateEnabled),
    }
  }

  async function ensureReady(force = false) {
    await Promise.all([
      taskCache.runTask('about:version', loadAppVersion, force),
      taskCache.runTask('about:update-state', loadUpdateState, force),
      taskCache.runTask('about:updater-settings', loadUpdaterSettings, force),
    ])
  }

  function applyUpdateState(state: UpdateState) {
    updateState.value = state
  }

  async function updateAutoUpdateSetting(value: boolean) {
    const previousSettings = { ...updaterSettings.value }
    updaterSettings.value = { autoUpdateEnabled: value }

    try {
      const nextSettings = await window.electron.update.updateSettings({
        autoUpdateEnabled: value,
      })
      updaterSettings.value = {
        autoUpdateEnabled: Boolean(nextSettings.autoUpdateEnabled),
      }
    } catch (error: any) {
      updaterSettings.value = previousSettings
      message.error(`保存失败: ${error?.message || String(error)}`)
    }
  }

  async function handleCheckUpdates() {
    checkingUpdate.value = true

    try {
      const result = await window.electron.update.check()
      if (result.success) {
        message.info(result.message)
        return
      }

      message.warning(result.message)
    } catch (error: any) {
      message.error(`检查更新失败: ${error?.message || String(error)}`)
    } finally {
      checkingUpdate.value = false
    }
  }

  async function handleInstallUpdate() {
    try {
      const result = await window.electron.update.quitAndInstall()
      if (!result.success) {
        message.warning(result.message)
      }
    } catch (error: any) {
      message.error(`安装更新失败: ${error?.message || String(error)}`)
    }
  }

  function handleOpenLink(url: string) {
    void window.electron.window.openExternal(url)
  }

  async function resetAll() {
    const nextSettings = await window.electron.update.updateSettings(DEFAULT_UPDATER_SETTINGS)
    updaterSettings.value = {
      autoUpdateEnabled: Boolean(nextSettings.autoUpdateEnabled),
    }
    taskCache.invalidate(['about:updater-settings'])
  }

  return {
    appVersion,
    applyUpdateState,
    canInstallUpdate,
    checkingUpdate,
    ensureReady,
    handleCheckUpdates,
    handleInstallUpdate,
    handleOpenLink,
    resetAll,
    updateAutoUpdateSetting,
    updateState,
    updateStatusLabel,
    updaterSettings,
  }
}
