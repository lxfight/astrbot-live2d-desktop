/**
 * 设置状态管理
 * 管理应用配置和快捷键
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { settingsService, type AppSettings } from '@/services'
import { logger } from '@/utils/logger'

export const useSettingsStore = defineStore('settings', () => {
  // 状态
  const settings = ref<AppSettings>({
    wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8765/ws',
    token: import.meta.env.VITE_WS_TOKEN || '',
    alwaysOnTop: import.meta.env.VITE_ALWAYS_ON_TOP === 'true',
    transparent: import.meta.env.VITE_TRANSPARENT !== 'false',
    modelScale: Number(import.meta.env.VITE_MODEL_SCALE) || 1.0,
    modelX: 0,
    modelY: 0,
    windowSize: {
      width: Number(import.meta.env.VITE_WINDOW_WIDTH) || 400,
      height: Number(import.meta.env.VITE_WINDOW_HEIGHT) || 600
    },
    windowPosition: null,
    mousePassthrough: import.meta.env.VITE_MOUSE_PASSTHROUGH_ENABLED !== 'false',
    alphaThreshold: Number(import.meta.env.VITE_ALPHA_THRESHOLD) || 10,
    hotkeys: {}
  })

  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // 计算属性
  const isElectron = computed(() => typeof window !== 'undefined' && !!window.electronAPI)

  // 操作
  async function loadSettings() {
    if (!isElectron.value) {
      logger.warn('非 Electron 环境，使用默认设置')
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const loaded = await settingsService.getSettings()
      settings.value = { ...settings.value, ...loaded }
      logger.info('设置已加载', settings.value)
    } catch (err) {
      error.value = err as Error
      logger.error('加载设置失败', err)
    } finally {
      isLoading.value = false
    }
  }

  async function saveSettings(updates: Partial<AppSettings>) {
    if (!isElectron.value) {
      logger.warn('非 Electron 环境，无法保存设置')
      return
    }

    isLoading.value = true
    error.value = null

    try {
      await settingsService.saveSettings(updates)
      settings.value = { ...settings.value, ...updates }
      logger.info('设置已保存', updates)
    } catch (err) {
      error.value = err as Error
      logger.error('保存设置失败', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) {
    await saveSettings({ [key]: value } as Partial<AppSettings>)
  }

  async function setAlwaysOnTop(value: boolean) {
    await Promise.all([
      updateSetting('alwaysOnTop', value),
      settingsService.setAlwaysOnTop(value)
    ])
  }

  async function setMousePassthrough(value: boolean) {
    await Promise.all([
      updateSetting('mousePassthrough', value),
      settingsService.setMousePassthrough(value)
    ])
  }

  function watchSettingsChange(callback: (settings: AppSettings) => void) {
    if (!isElectron.value) return
    settingsService.onSettingsChanged(callback)
  }

  return {
    // 状态
    settings,
    isLoading,
    error,
    isElectron,

    // 操作
    loadSettings,
    saveSettings,
    updateSetting,
    setAlwaysOnTop,
    setMousePassthrough,
    watchSettingsChange
  }
})
