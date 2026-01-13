/**
 * 设置管理 Composable
 * 提供设置的加载、保存和状态管理
 */

import { ref, type Ref } from 'vue'
import { logger } from '../utils/logger'

export interface AppSettings {
  wsUrl: string
  token: string
  alwaysOnTop: boolean
  transparent: boolean
  modelScale: number
  modelX: number
  modelY: number
  passthroughEnabled: boolean
  alphaThreshold: number
  debounceMs: number
  eyeTracking: boolean
  clickFeedback: boolean
  dragEnabled: boolean
  autoLaunch: boolean
  currentModel: string
  recordHotkey: string
}

// 默认设置
const defaultSettings: AppSettings = {
  wsUrl: 'ws://localhost:8765/ws',
  token: '',
  alwaysOnTop: true,
  transparent: true,
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
  recordHotkey: 'CommandOrControl+T'
}

export function useSettings() {
  const settings: Ref<AppSettings> = ref({ ...defaultSettings })
  const showSaveSuccess = ref(false)
  const hotkeyConflict = ref(false)

  // 加载设置
  const loadSettings = async () => {
    if (window.electronAPI?.getSettings) {
      try {
        const savedSettings = await window.electronAPI.getSettings()
        settings.value = { ...defaultSettings, ...savedSettings }
        logger.info('设置加载成功')
      } catch (error) {
        logger.error('加载设置失败:', error)
      }
    }
  }

  // 保存设置
  const saveSettings = async () => {
    if (window.electronAPI?.setSettings) {
      try {
        const result = await window.electronAPI.setSettings(settings.value)

        if (result.conflict) {
          hotkeyConflict.value = true
          return false
        }

        showSaveSuccess.value = true
        setTimeout(() => {
          showSaveSuccess.value = false
        }, 2000)

        logger.info('设置保存成功')
        return true
      } catch (error) {
        logger.error('保存设置失败:', error)
        return false
      }
    }
    return false
  }

  // 恢复默认设置
  const resetSettings = () => {
    settings.value = { ...defaultSettings }
    logger.info('设置已恢复默认')
  }

  return {
    settings,
    showSaveSuccess,
    hotkeyConflict,
    loadSettings,
    saveSettings,
    resetSettings,
    defaultSettings
  }
}
