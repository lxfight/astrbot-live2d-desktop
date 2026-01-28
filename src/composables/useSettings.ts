/**
 * 设置管理 Composable
 * 提供设置的加载、保存和状态管理
 */

import { computed, ref, toRaw, type Ref } from 'vue'
import { logger } from '../utils/logger'
import type { AppSettings as CoreAppSettings } from '../types/settings'

// Settings window type: extends the app-level settings with a few required fields
// used throughout the UI (even if some are optional at runtime).
export interface AppSettings extends CoreAppSettings {
  eyeTracking: boolean
  clickFeedback: boolean
  dragEnabled: boolean
  passthroughEnabled: boolean
  alphaThreshold: number
  debounceMs: number
  autoLaunch: boolean
  recordHotkey: string
  gameMode: boolean
  fullscreenHideTimeout: number
  gameModeAutoRestore: boolean
}

// 默认设置
const defaultSettings: AppSettings = {
  wsUrl: 'ws://localhost:9090/astrbot/live2d',
  token: '',
  alwaysOnTop: true,
  transparent: true,
  windowSize: { width: 400, height: 600 },
  windowPosition: null,
  modelScale: 1.0,
  modelX: 0,
  modelY: 0,
  passthroughEnabled: true,
  alphaThreshold: 10,
  debounceMs: 50,
  eyeTracking: true,
  clickFeedback: true,
  dragEnabled: true,
  autoLaunch: false,
  currentModel: 'default',
  recordHotkey: 'CommandOrControl+T',
  gameMode: true,
  fullscreenHideTimeout: 3000,
  gameModeAutoRestore: true
}

export function useSettings() {
  // settings: last saved snapshot
  const settings: Ref<AppSettings> = ref({ ...defaultSettings })
  // draft: editable copy used by the settings window UI
  const draft: Ref<AppSettings> = ref({ ...defaultSettings })

  const showSaveSuccess = ref(false)
  const hotkeyConflict = ref(false)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const lastSaveError = ref<string | null>(null)
  let lastErrorTimer: number | null = null

  const isDirty = computed(() => {
    // AppSettings only contains primitives -> shallow compare is enough.
    const a = settings.value
    const b = draft.value
    return (Object.keys(defaultSettings) as Array<keyof AppSettings>).some((k) => a[k] !== b[k])
  })

  const validation = computed(() => {
    const errors: Record<string, string> = {}

    const wsUrl = String(draft.value.wsUrl || '').trim()
    if (!wsUrl) errors.wsUrl = '请输入 WebSocket 地址'
    else if (!/^wss?:\/\//i.test(wsUrl)) errors.wsUrl = '地址需以 ws:// 或 wss:// 开头'

    // recordHotkey is optional, but when present it should be a valid Electron accelerator.
    const hk = String(draft.value.recordHotkey || '').trim()
    if (hk && !hk.includes('+')) errors.recordHotkey = '快捷键需要包含至少一个修饰键（如 Ctrl/Shift/Alt）'

    return {
      isValid: Object.keys(errors).length === 0 && !hotkeyConflict.value,
      errors
    }
  })

  // 加载设置
  const loadSettings = async () => {
    if (window.electronAPI?.getSettings) {
      try {
        isLoading.value = true
        const savedSettings = await window.electronAPI.getSettings()
        settings.value = { ...defaultSettings, ...savedSettings }
        draft.value = { ...settings.value }
        logger.info('设置加载成功')
      } catch (error) {
        logger.error('加载设置失败:', error)
      } finally {
        isLoading.value = false
      }
    }
  }

  // 保存设置
  const saveSettings = async () => {
    if (window.electronAPI?.setSettings) {
      try {
        isSaving.value = true
        lastSaveError.value = null
        const payload = { ...toRaw(draft.value) }
        const result = await window.electronAPI.setSettings(payload)

        if (result.conflict) {
          hotkeyConflict.value = true
          return false
        }

        // Sync saved snapshot after a successful save.
        settings.value = { ...payload }
        showSaveSuccess.value = true
        setTimeout(() => {
          showSaveSuccess.value = false
        }, 2000)

        logger.info('设置保存成功')
        return true
      } catch (error) {
        logger.error('保存设置失败:', error)
        lastSaveError.value = error instanceof Error ? error.message : String(error)
        if (lastErrorTimer) window.clearTimeout(lastErrorTimer)
        lastErrorTimer = window.setTimeout(() => {
          lastSaveError.value = null
          lastErrorTimer = null
        }, 3500)
        return false
      } finally {
        isSaving.value = false
      }
    }
    return false
  }

  // Discard changes (back to last saved snapshot)
  const resetDraft = () => {
    draft.value = { ...settings.value }
    hotkeyConflict.value = false
  }

  // Restore defaults (does not save automatically)
  const resetToDefaults = () => {
    draft.value = { ...defaultSettings }
    hotkeyConflict.value = false
    logger.info('设置草稿已恢复默认')
  }

  return {
    settings,
    draft,
    isDirty,
    validation,
    isLoading,
    isSaving,
    lastSaveError,
    showSaveSuccess,
    hotkeyConflict,
    loadSettings,
    saveSettings,
    resetDraft,
    resetToDefaults,
    defaultSettings
  }
}
