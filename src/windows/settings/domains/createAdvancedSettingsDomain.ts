import {
  computed,
  inject,
  ref,
  type ComputedRef,
  type InjectionKey,
  type Ref,
  type WritableComputedRef,
} from 'vue'
import { useMessage } from 'naive-ui'
import {
  type AdvancedSettings,
  DEFAULT_ADVANCED_SETTINGS,
  clampMaxRecordingSeconds,
  loadAdvancedSettings,
  normalizeAdvancedSettings,
  saveAdvancedSettings as persistAdvancedSettings,
} from '@/utils/advancedSettings'
import {
  buildDefaultConnectionBehaviorSettings,
  normalizeConnectionBehaviorSettings,
  type ConnectionBehaviorSettingsPersistedV1,
} from '@/shared/connectionBehaviorSettings'
import {
  DEFAULT_DESKTOP_FEATURE_SETTINGS,
  type DesktopFeatureSettings,
} from '@/utils/desktopFeatureSettings'
import {
  DEFAULT_SCREENSHOT_SETTINGS,
  type ScreenshotSettings,
} from '@/utils/screenshotSettings'
import { createDeferredTaskCache } from '../composables/createDeferredTaskCache'

export interface AdvancedSettingsDomain {
  advancedSettings: Ref<AdvancedSettings>
  alwaysOnTopLevelLabel: ComputedRef<string>
  applyConnectionBehaviorSettingsState: (settings: ConnectionBehaviorSettingsPersistedV1) => void
  applyDesktopFeatureSettingsState: (settings: DesktopFeatureSettings) => void
  applyAdvancedSettingChange: () => Promise<void>
  checkShortcutRegistration: (force?: boolean) => Promise<void>
  connectionBehaviorSettings: Ref<ConnectionBehaviorSettingsPersistedV1>
  desktopFeatureSettings: Ref<DesktopFeatureSettings>
  ensureBaseReady: (force?: boolean) => Promise<void>
  ensureBehaviorReady: (force?: boolean) => Promise<void>
  ensureShortcutReady: (force?: boolean) => Promise<void>
  gameModeCapabilityLabel: ComputedRef<string>
  handleClearShortcut: () => Promise<void>
  handleRegisterShortcut: () => Promise<void>
  handleShortcutKeyDown: (event: KeyboardEvent) => void
  handleThemeFollowChange: (_value: boolean) => Promise<void>
  passThroughCapabilityLabel: ComputedRef<string>
  platformCapabilities: Ref<PlatformCapabilities | null>
  platformCompatibilityNotice: ComputedRef<null | { type: 'info' | 'warning'; text: string }>
  platformDisplayName: ComputedRef<string>
  recordingSecondsValue: WritableComputedRef<number | null>
  resetAll: () => Promise<void>
  screenshotSettings: Ref<ScreenshotSettings>
  shortcutRegistered: Ref<boolean>
  updateConnectionBehaviorSettings: (patch: Partial<ConnectionBehaviorSettingsPersistedV1>) => Promise<void>
  updateDesktopFeatureSetting: (
    key: 'alwaysOnTop' | 'fullPassThrough' | 'dynamicPassThrough' | 'autoDetectFullscreen',
    value: boolean,
  ) => Promise<void>
  updateScreenshotSettings: (patch: Partial<ScreenshotSettings>) => Promise<void>
}

export const advancedSettingsDomainKey: InjectionKey<AdvancedSettingsDomain> = Symbol('advanced-settings-domain')

export function useAdvancedSettingsDomain() {
  const domain = inject(advancedSettingsDomainKey)
  if (!domain) {
    throw new Error('AdvancedSettingsDomain 未注入')
  }

  return domain
}

function normalizeScreenshotSettings(settings: ScreenshotSettings): ScreenshotSettings {
  return {
    defaultTarget: settings.defaultTarget === 'desktop' ? 'desktop' : 'active',
    quality: Number(settings.quality) || DEFAULT_SCREENSHOT_SETTINGS.quality,
    maxWidth: Number(settings.maxWidth) || DEFAULT_SCREENSHOT_SETTINGS.maxWidth,
  }
}

type MessageApi = ReturnType<typeof useMessage>

export function createAdvancedSettingsDomain(message: MessageApi): AdvancedSettingsDomain {
  const advancedSettings = ref<AdvancedSettings>({ ...DEFAULT_ADVANCED_SETTINGS })
  const connectionBehaviorSettings = ref<ConnectionBehaviorSettingsPersistedV1>(
    buildDefaultConnectionBehaviorSettings(),
  )
  const desktopFeatureSettings = ref<DesktopFeatureSettings>({
    ...DEFAULT_DESKTOP_FEATURE_SETTINGS,
  })
  const screenshotSettings = ref<ScreenshotSettings>({
    ...DEFAULT_SCREENSHOT_SETTINGS,
  })
  const platformCapabilities = ref<PlatformCapabilities | null>(null)
  const shortcutRegistered = ref(false)

  const taskCache = createDeferredTaskCache()

  const recordingSecondsValue = computed({
    get: () => advancedSettings.value.maxRecordingSeconds,
    set: (value: number | null) => {
      advancedSettings.value.maxRecordingSeconds = clampMaxRecordingSeconds(
        value ?? DEFAULT_ADVANCED_SETTINGS.maxRecordingSeconds,
      )
    },
  })

  const platformDisplayName = computed(() => {
    const capabilities = platformCapabilities.value
    if (!capabilities) return '未知'
    if (capabilities.platform === 'win32') return 'Windows'
    if (capabilities.platform === 'darwin') return 'macOS'
    if (capabilities.platform === 'linux') {
      return capabilities.linuxSessionType === 'n/a'
        ? 'Linux'
        : `Linux (${capabilities.linuxSessionType})`
    }
    return capabilities.platform
  })

  const gameModeCapabilityLabel = computed(() => {
    const capabilities = platformCapabilities.value
    if (!capabilities) return '未知'
    if (!capabilities.gameMode.supported) {
      return `不可用（${capabilities.gameMode.reason || '当前平台暂不支持'}）`
    }
    return capabilities.gameMode.mode === 'native-window-manager'
      ? '可用（原生窗口管理器）'
      : '可用（活跃窗口启发式）'
  })

  const passThroughCapabilityLabel = computed(() => {
    const capabilities = platformCapabilities.value
    if (!capabilities) return '未知'
    return capabilities.mousePassthroughForward
      ? '支持'
      : '不支持（当前平台无法稳定转发鼠标事件）'
  })

  const alwaysOnTopLevelLabel = computed(() => {
    const capabilities = platformCapabilities.value
    if (!capabilities) return '未知'
    return capabilities.alwaysOnTopLevel === 'screen-saver' ? 'screen-saver' : 'default'
  })

  const platformCompatibilityNotice = computed<null | { type: 'info' | 'warning'; text: string }>(() => {
    const capabilities = platformCapabilities.value
    if (!capabilities) return null

    if (capabilities.platform === 'linux') {
      if (capabilities.linuxSessionType === 'wayland') {
        return {
          type: 'warning',
          text: 'Wayland 会话下智能穿透与自动检测全屏应用不可用；建议在支持 X11 的环境中使用以获得更完整体验。',
        }
      }

      return {
        type: 'info',
        text: 'Linux 会话下智能穿透不可用，自动更新需通过 Releases 手动下载。',
      }
    }

    if (capabilities.platform === 'win32' && !capabilities.gameMode.supported) {
      return {
        type: 'info',
        text: `当前 Windows 平台已关闭自动检测全屏应用：${capabilities.gameMode.reason || '能力不可用'}`,
      }
    }

    return null
  })

  async function applyLogLevelSetting(level: 'info' | 'debug') {
    try {
      await window.electron.log.setLevel(level)
    } catch (error) {
      console.warn('[设置] 应用日志级别失败:', error)
    }
  }

  async function loadBaseSettings() {
    advancedSettings.value = loadAdvancedSettings()
    await applyLogLevelSetting(advancedSettings.value.logLevel)
  }

  function applyConnectionBehaviorSettingsState(settings: ConnectionBehaviorSettingsPersistedV1) {
    connectionBehaviorSettings.value = normalizeConnectionBehaviorSettings(settings)
  }

  async function loadConnectionBehaviorSettings() {
    const result = await window.electron.connectionBehaviorSettings.load()
    if (!result.success) {
      throw new Error(result.message)
    }

    applyConnectionBehaviorSettingsState(result.data)
  }

  function applyDesktopFeatureSettingsState(settings: DesktopFeatureSettings) {
    desktopFeatureSettings.value = {
      alwaysOnTop: Boolean(settings.alwaysOnTop),
      fullPassThrough: Boolean(settings.fullPassThrough),
      dynamicPassThrough: Boolean(settings.dynamicPassThrough),
      autoDetectFullscreen: Boolean(settings.autoDetectFullscreen),
    }
  }

  async function loadDesktopFeatureSettings() {
    applyDesktopFeatureSettingsState(await window.electron.desktopBehavior.getPreferences())
  }

  async function loadScreenshotSettings() {
    const settings = await window.electron.window.getScreenshotSettings()
    screenshotSettings.value = normalizeScreenshotSettings(settings)
  }

  async function loadPlatformCapabilities() {
    try {
      platformCapabilities.value = await window.electron.window.getPlatformCapabilities()
    } catch {
      platformCapabilities.value = null
    }
  }

  function convertToElectronFormat(shortcut: string) {
    return shortcut.replace('Ctrl', 'CommandOrControl')
  }

  async function checkShortcutRegistration(force = false) {
    await ensureBaseReady(force)

    await taskCache.runTask('advanced:shortcut-registration', async () => {
      if (!advancedSettings.value.recordingShortcut) {
        shortcutRegistered.value = false
        return
      }

      const electronFormat = convertToElectronFormat(advancedSettings.value.recordingShortcut)
      shortcutRegistered.value = await window.electron.shortcut.isRegistered(electronFormat)
    }, force)
  }

  async function ensureBaseReady(force = false) {
    await taskCache.runTask('advanced:base', loadBaseSettings, force)
  }

  async function ensureBehaviorReady(force = false) {
    await Promise.all([
      ensureBaseReady(force),
      taskCache.runTask('advanced:connection-behavior', loadConnectionBehaviorSettings, force),
      taskCache.runTask('advanced:desktop', loadDesktopFeatureSettings, force),
      taskCache.runTask('advanced:screenshot', loadScreenshotSettings, force),
      taskCache.runTask('advanced:platform', loadPlatformCapabilities, force),
    ])
  }

  async function ensureShortcutReady(force = false) {
    await Promise.all([
      ensureBaseReady(force),
      checkShortcutRegistration(force),
    ])
  }

  async function applyAdvancedSettingChange() {
    advancedSettings.value = persistAdvancedSettings(advancedSettings.value)
    await applyLogLevelSetting(advancedSettings.value.logLevel)
  }

  async function handleThemeFollowChange(_value: boolean) {
    await applyAdvancedSettingChange()
  }

  async function updateDesktopFeatureSetting(
    key: 'alwaysOnTop' | 'fullPassThrough' | 'dynamicPassThrough' | 'autoDetectFullscreen',
    value: boolean,
  ) {
    const previousSettings = { ...desktopFeatureSettings.value }
    const nextSettings = {
      ...desktopFeatureSettings.value,
      [key]: value,
    }

    desktopFeatureSettings.value = nextSettings

    try {
      const savedSettings = await window.electron.desktopBehavior.updatePreferences({
        alwaysOnTop: nextSettings.alwaysOnTop,
        fullPassThrough: nextSettings.fullPassThrough,
        dynamicPassThrough: nextSettings.dynamicPassThrough,
        autoDetectFullscreen: nextSettings.autoDetectFullscreen,
      })
      applyDesktopFeatureSettingsState(savedSettings)
    } catch (error: any) {
      desktopFeatureSettings.value = previousSettings
      message.error(`保存失败: ${error?.message || String(error)}`)
    }
  }

  function createScreenshotSettingsPayload(): ScreenshotSettings {
    return {
      defaultTarget: screenshotSettings.value.defaultTarget,
      quality: screenshotSettings.value.quality,
      maxWidth: screenshotSettings.value.maxWidth,
    }
  }

  async function updateScreenshotSettings(patch: Partial<ScreenshotSettings>) {
    const previousSettings = { ...screenshotSettings.value }
    screenshotSettings.value = {
      ...screenshotSettings.value,
      ...patch,
    }

    try {
      const nextSettings = await window.electron.window.updateScreenshotSettings(createScreenshotSettingsPayload())
      screenshotSettings.value = normalizeScreenshotSettings(nextSettings)
    } catch (error: any) {
      screenshotSettings.value = previousSettings
      message.error(`保存失败: ${error?.message || String(error)}`)
    }
  }

  async function updateConnectionBehaviorSettings(patch: Partial<ConnectionBehaviorSettingsPersistedV1>) {
    const previousSettings = { ...connectionBehaviorSettings.value }
    connectionBehaviorSettings.value = normalizeConnectionBehaviorSettings({
      ...connectionBehaviorSettings.value,
      ...patch,
    })

    try {
      const result = await window.electron.connectionBehaviorSettings.save({
        data: connectionBehaviorSettings.value,
      })
      if (!result.success) {
        throw new Error(result.message)
      }

      applyConnectionBehaviorSettingsState(result.data)
    } catch (error: any) {
      connectionBehaviorSettings.value = previousSettings
      message.error(`保存失败: ${error?.message || String(error)}`)
    }
  }

  function handleShortcutKeyDown(event: KeyboardEvent) {
    event.preventDefault()

    const keys: string[] = []
    if (event.ctrlKey || event.metaKey) keys.push('Ctrl')
    if (event.altKey) keys.push('Alt')
    if (event.shiftKey) keys.push('Shift')

    const key = event.key.toUpperCase()
    if (key.length === 1 && /[A-Z0-9]/.test(key)) {
      keys.push(key)
    } else if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(event.key)) {
      keys.push(event.key)
    }

    if (keys.length > 1) {
      advancedSettings.value.recordingShortcut = keys.join('+')
      shortcutRegistered.value = false
      taskCache.invalidate(['advanced:shortcut-registration'])
    }
  }

  async function handleClearShortcut() {
    await window.electron.shortcut.unregister()
    advancedSettings.value.recordingShortcut = ''
    shortcutRegistered.value = false
    taskCache.invalidate(['advanced:shortcut-registration'])
    await applyAdvancedSettingChange()
    message.success('快捷键已清除')
  }

  async function handleRegisterShortcut() {
    if (!advancedSettings.value.recordingShortcut) {
      message.warning('请先设置快捷键')
      return
    }

    const electronFormat = convertToElectronFormat(advancedSettings.value.recordingShortcut)
    const result = await window.electron.shortcut.register(electronFormat)
    if (!result.success) {
      message.error(`注册失败: ${result.error}`)
      return
    }

    shortcutRegistered.value = true
    advancedSettings.value = persistAdvancedSettings(advancedSettings.value)
    message.success('快捷键注册成功')
  }

  async function resetAll() {
    advancedSettings.value = normalizeAdvancedSettings(DEFAULT_ADVANCED_SETTINGS)
    persistAdvancedSettings(advancedSettings.value)
    await applyLogLevelSetting(advancedSettings.value.logLevel)

    const behaviorResult = await window.electron.connectionBehaviorSettings.save({
      data: buildDefaultConnectionBehaviorSettings(),
    })
    if (!behaviorResult.success) {
      throw new Error(behaviorResult.message)
    }
    applyConnectionBehaviorSettingsState(behaviorResult.data)

    const desktopSettings = await window.electron.desktopBehavior.updatePreferences(DEFAULT_DESKTOP_FEATURE_SETTINGS)
    applyDesktopFeatureSettingsState(desktopSettings)

    const nextScreenshotSettings = await window.electron.window.updateScreenshotSettings(DEFAULT_SCREENSHOT_SETTINGS)
    screenshotSettings.value = normalizeScreenshotSettings(nextScreenshotSettings)

    shortcutRegistered.value = false
    taskCache.invalidate()
  }

  return {
    advancedSettings,
    alwaysOnTopLevelLabel,
    applyConnectionBehaviorSettingsState,
    applyDesktopFeatureSettingsState,
    applyAdvancedSettingChange,
    checkShortcutRegistration,
    connectionBehaviorSettings,
    desktopFeatureSettings,
    ensureBaseReady,
    ensureBehaviorReady,
    ensureShortcutReady,
    gameModeCapabilityLabel,
    handleClearShortcut,
    handleRegisterShortcut,
    handleShortcutKeyDown,
    handleThemeFollowChange,
    passThroughCapabilityLabel,
    platformCapabilities,
    platformCompatibilityNotice,
    platformDisplayName,
    recordingSecondsValue,
    resetAll,
    screenshotSettings,
    shortcutRegistered,
    updateConnectionBehaviorSettings,
    updateDesktopFeatureSetting,
    updateScreenshotSettings,
  }
}
