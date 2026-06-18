import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { createDeferredTaskCache } from '../composables/createDeferredTaskCache'

function createDefaultAwarenessSettings(): DesktopAwarenessSettings {
  return {
    enabled: true,
    mode: 'smart',
    appScope: {
      mode: 'all',
      apps: []
    },
    privacy: {
      shareWindowTitle: false,
      allowScreenshotOnRequest: true
    }
  }
}

function cloneAwarenessSettings(config: DesktopAwarenessSettings): DesktopAwarenessSettings {
  return {
    enabled: Boolean(config.enabled),
    mode: config.mode,
    appScope: {
      mode: config.appScope.mode,
      apps: [...config.appScope.apps]
    },
    privacy: {
      shareWindowTitle: Boolean(config.privacy.shareWindowTitle),
      allowScreenshotOnRequest: Boolean(config.privacy.allowScreenshotOnRequest)
    }
  }
}

function parseAppList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split('\n')
        .map(item => item.trim())
        .filter(Boolean)
    )
  )
}

export interface WatcherSettingsDomain {
  appScopeInput: Ref<string>
  canSave: ComputedRef<boolean>
  dirty: ComputedRef<boolean>
  draftConfig: Ref<DesktopAwarenessSettings>
  ensureReady: (force?: boolean) => Promise<void>
  recentApps: Ref<DesktopAwarenessSnapshot['recentApps']>
  resetDraft: () => void
  resetPersisted: () => Promise<void>
  saveDraft: () => Promise<void>
  saving: Ref<boolean>
  snapshot: Ref<DesktopAwarenessSnapshot | null>
  status: Ref<'idle' | 'loading' | 'ready' | 'error'>
  addAppToScope: (appKey: string, scopeMode?: 'include' | 'exclude') => void
  removeAppFromScope: (appKey: string) => void
  updateAppScopeInput: (value: string) => void
}

export const watcherSettingsDomainKey: InjectionKey<WatcherSettingsDomain> =
  Symbol('watcher-settings-domain')

export function useWatcherSettingsDomain() {
  const domain = inject(watcherSettingsDomainKey)
  if (!domain) {
    throw new Error('WatcherSettingsDomain 未注入')
  }

  return domain
}

type MessageApi = ReturnType<typeof useMessage>

export function createWatcherSettingsDomain(message: MessageApi): WatcherSettingsDomain {
  const { t } = useI18n()
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const saving = ref(false)
  const draftConfig = ref<DesktopAwarenessSettings>(createDefaultAwarenessSettings())
  const savedConfig = ref<DesktopAwarenessSettings>(createDefaultAwarenessSettings())
  const snapshot = ref<DesktopAwarenessSnapshot | null>(null)
  const recentApps = ref<DesktopAwarenessSnapshot['recentApps']>([])
  const appScopeInput = ref('')
  const savedSnapshot = ref('')
  let snapshotUnsubscribe: Unsubscribe | null = null

  const taskCache = createDeferredTaskCache()

  function buildSnapshot(config: DesktopAwarenessSettings) {
    return JSON.stringify(config)
  }

  function applySavedConfig(config: DesktopAwarenessSettings) {
    const nextConfig = cloneAwarenessSettings(config)
    savedConfig.value = nextConfig
    draftConfig.value = cloneAwarenessSettings(nextConfig)
    appScopeInput.value = nextConfig.appScope.apps.join('\n')
    savedSnapshot.value = buildSnapshot(cloneAwarenessSettings(nextConfig))
  }

  async function refreshSnapshot() {
    const nextSnapshot = await window.electron.desktopAwareness.getSnapshot()
    snapshot.value = nextSnapshot
    recentApps.value = nextSnapshot.recentApps
  }

  function bindSnapshotUpdates() {
    if (snapshotUnsubscribe) return
    snapshotUnsubscribe = window.electron.desktopAwareness.onSnapshotChanged(nextSnapshot => {
      snapshot.value = nextSnapshot
      recentApps.value = nextSnapshot.recentApps
    })
  }

  const dirty = computed(
    () => buildSnapshot(cloneAwarenessSettings(draftConfig.value)) !== savedSnapshot.value
  )
  const canSave = computed(() => dirty.value && !saving.value)

  function updateAppScopeInput(value: string) {
    appScopeInput.value = value
    draftConfig.value.appScope.apps = parseAppList(value)
  }

  function addAppToScope(appKey: string, scopeMode?: 'include' | 'exclude') {
    const key = appKey.trim()
    if (!key) return
    if (scopeMode) {
      draftConfig.value.appScope.mode = scopeMode
    }
    if (!draftConfig.value.appScope.apps.includes(key)) {
      draftConfig.value.appScope.apps = [...draftConfig.value.appScope.apps, key]
      appScopeInput.value = draftConfig.value.appScope.apps.join('\n')
    }
  }

  function removeAppFromScope(appKey: string) {
    draftConfig.value.appScope.apps = draftConfig.value.appScope.apps.filter(app => app !== appKey)
    appScopeInput.value = draftConfig.value.appScope.apps.join('\n')
  }

  async function ensureReady(force = false) {
    if (status.value === 'ready' && !force) {
      return
    }

    status.value = 'loading'

    try {
      bindSnapshotUpdates()
      await taskCache.runTask(
        'desktop-awareness:settings',
        async () => {
          const [settings] = await Promise.all([
            window.electron.desktopAwareness.getSettings(),
            refreshSnapshot()
          ])
          applySavedConfig(settings)
        },
        force
      )
      status.value = 'ready'
    } catch (error) {
      status.value = 'error'
      throw error
    }
  }

  function resetDraft() {
    applySavedConfig(savedConfig.value)
  }

  async function saveDraft() {
    if (!canSave.value) {
      return
    }

    saving.value = true

    try {
      await window.electron.desktopAwareness.updateSettings(
        cloneAwarenessSettings(draftConfig.value)
      )
      taskCache.invalidate(['desktop-awareness:settings'])
      await ensureReady(true)
      message.success(t('toast.watcherConfigSaved'))
    } catch (error: any) {
      message.error(t('toast.watcherConfigSaveFailed', { error: error?.message || String(error) }))
    } finally {
      saving.value = false
    }
  }

  async function resetPersisted() {
    saving.value = true

    try {
      const result = await window.electron.desktopAwareness.resetSettings()
      applySavedConfig(result.settings)
      await refreshSnapshot()
      taskCache.invalidate(['desktop-awareness:settings'])
      status.value = 'ready'
      message.success(t('toast.watcherConfigReset'))
    } catch (error: any) {
      message.error(t('toast.watcherConfigResetFailed', { error: error?.message || String(error) }))
      throw error
    } finally {
      saving.value = false
    }
  }

  return {
    appScopeInput,
    canSave,
    dirty,
    draftConfig,
    ensureReady,
    recentApps,
    resetDraft,
    resetPersisted,
    saveDraft,
    saving,
    snapshot,
    status,
    addAppToScope,
    removeAppFromScope,
    updateAppScopeInput
  }
}
