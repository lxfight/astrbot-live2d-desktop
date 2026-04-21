import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { createDeferredTaskCache } from '../composables/createDeferredTaskCache'

const BUILTIN_PROCESS_NAMES = [
  'dwm.exe', 'csrss.exe', 'explorer.exe', 'SearchUI.exe',
  'ShellExperienceHost.exe', 'StartMenuExperienceHost.exe',
  'TextInputHost.exe', 'SecurityHealthSystray.exe',
]

const BUILTIN_TITLE_KEYWORDS = [
  'Program Manager', '锁屏', 'Lock Screen', 'LockApp',
  'Windows Shell Experience Host', 'Windows Default Lock Screen',
  'Windows 输入体验', 'Task Switching', 'Task View',
]

function createDefaultWatcherConfig(): WindowWatcherConfig {
  return {
    enabled: true,
    appLaunchEnabled: true,
    throttle: {
      globalInterval: 1000,
      perWindowInterval: 3000,
      minInterval: 100,
    },
    events: {
      focus: true,
      blur: false,
      create: true,
      destroy: false,
      fullscreen: true,
      windowed: false,
      resize: false,
      move: false,
      minimize: false,
      maximize: false,
      restore: false,
    },
    ignore: {
      processNames: ['dwm.exe', 'csrss.exe', 'explorer.exe'],
      titleKeywords: ['Program Manager', '锁屏', 'Lock Screen'],
    },
    aiResponse: {
      mode: 'first-open',
      specificApps: [],
    },
  }
}

function cloneWatcherConfig(config: WindowWatcherConfig): WindowWatcherConfig {
  return {
    enabled: Boolean(config.enabled),
    appLaunchEnabled: Boolean(config.appLaunchEnabled),
    throttle: {
      globalInterval: Number(config.throttle.globalInterval),
      perWindowInterval: Number(config.throttle.perWindowInterval),
      minInterval: Number(config.throttle.minInterval),
    },
    events: {
      focus: Boolean(config.events.focus),
      blur: Boolean(config.events.blur),
      create: Boolean(config.events.create),
      destroy: Boolean(config.events.destroy),
      fullscreen: Boolean(config.events.fullscreen),
      windowed: Boolean(config.events.windowed),
      resize: Boolean(config.events.resize),
      move: Boolean(config.events.move),
      minimize: Boolean(config.events.minimize),
      maximize: Boolean(config.events.maximize),
      restore: Boolean(config.events.restore),
    },
    ignore: {
      processNames: [...config.ignore.processNames],
      titleKeywords: [...config.ignore.titleKeywords],
    },
    aiResponse: {
      mode: config.aiResponse.mode,
      specificApps: [...config.aiResponse.specificApps],
    },
  }
}

export interface WatcherSettingsDomain {
  canSave: ComputedRef<boolean>
  dirty: ComputedRef<boolean>
  draftConfig: Ref<WindowWatcherConfig>
  ensureReady: (force?: boolean) => Promise<void>
  ignoreProcessNamesInput: Ref<string>
  ignoreTitleKeywordsInput: Ref<string>
  resetDraft: () => void
  resetPersisted: () => Promise<void>
  saveDraft: () => Promise<void>
  saving: Ref<boolean>
  specificAppsInput: Ref<string>
  status: Ref<'idle' | 'loading' | 'ready' | 'error'>
  updateIgnoreProcessNames: (value: string) => void
  updateIgnoreTitleKeywords: (value: string) => void
  updateSpecificApps: (value: string) => void
}

export const watcherSettingsDomainKey: InjectionKey<WatcherSettingsDomain> = Symbol('watcher-settings-domain')

export function useWatcherSettingsDomain() {
  const domain = inject(watcherSettingsDomainKey)
  if (!domain) {
    throw new Error('WatcherSettingsDomain 未注入')
  }

  return domain
}

type MessageApi = ReturnType<typeof useMessage>

export function createWatcherSettingsDomain(message: MessageApi): WatcherSettingsDomain {
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const saving = ref(false)
  const draftConfig = ref<WindowWatcherConfig>(createDefaultWatcherConfig())
  const savedConfig = ref<WindowWatcherConfig>(createDefaultWatcherConfig())
  const specificAppsInput = ref('')
  const ignoreProcessNamesInput = ref('')
  const ignoreTitleKeywordsInput = ref('')
  const savedSnapshot = ref('')

  const taskCache = createDeferredTaskCache()

  function buildSnapshot(config: WindowWatcherConfig) {
    return JSON.stringify(config)
  }

  function applySavedConfig(config: WindowWatcherConfig) {
    const nextConfig = cloneWatcherConfig(config)
    savedConfig.value = nextConfig
    draftConfig.value = cloneWatcherConfig(nextConfig)
    specificAppsInput.value = nextConfig.aiResponse.specificApps.join('\n')
    ignoreProcessNamesInput.value = nextConfig.ignore.processNames.join('\n')
    ignoreTitleKeywordsInput.value = nextConfig.ignore.titleKeywords.join('\n')
    savedSnapshot.value = buildSnapshot(cloneWatcherConfig(nextConfig))
  }

  const dirty = computed(() => buildSnapshot(cloneWatcherConfig(draftConfig.value)) !== savedSnapshot.value)
  const canSave = computed(() => dirty.value && !saving.value)

  function updateSpecificApps(value: string) {
    specificAppsInput.value = value
    draftConfig.value.aiResponse.specificApps = value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function updateIgnoreProcessNames(value: string) {
    ignoreProcessNamesInput.value = value
    draftConfig.value.ignore.processNames = value
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => Boolean(item) && !BUILTIN_PROCESS_NAMES.includes(item))
  }

  function updateIgnoreTitleKeywords(value: string) {
    ignoreTitleKeywordsInput.value = value
    draftConfig.value.ignore.titleKeywords = value
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => Boolean(item) && !BUILTIN_TITLE_KEYWORDS.some((keyword) => item.toLowerCase().includes(keyword.toLowerCase())))
  }

  async function ensureReady(force = false) {
    if (status.value === 'ready' && !force) {
      return
    }

    status.value = 'loading'

    try {
      await taskCache.runTask('watcher:config', async () => {
        const config = await window.electron.window.getWatcherConfig()
        applySavedConfig(config)
      }, force)
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
      await window.electron.window.updateWatcherConfig(cloneWatcherConfig(draftConfig.value))
      taskCache.invalidate(['watcher:config'])
      await ensureReady(true)
      message.success('窗口监听配置已保存')
    } catch (error: any) {
      message.error(`保存失败: ${error?.message || String(error)}`)
    } finally {
      saving.value = false
    }
  }

  async function resetPersisted() {
    saving.value = true

    try {
      const result = await window.electron.window.resetWatcherConfig()
      applySavedConfig(result.config)
      taskCache.invalidate(['watcher:config'])
      status.value = 'ready'
      message.success('窗口监听配置已重置')
    } catch (error: any) {
      message.error(`重置失败: ${error?.message || String(error)}`)
      throw error
    } finally {
      saving.value = false
    }
  }

  return {
    canSave,
    dirty,
    draftConfig,
    ensureReady,
    ignoreProcessNamesInput,
    ignoreTitleKeywordsInput,
    resetDraft,
    resetPersisted,
    saveDraft,
    saving,
    specificAppsInput,
    status,
    updateIgnoreProcessNames,
    updateIgnoreTitleKeywords,
    updateSpecificApps,
  }
}
