/**
 * Settings Store 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with default settings', () => {
    const store = useSettingsStore()
    expect(store.settings).toBeDefined()
    expect(store.settings.wsUrl).toBeTruthy()
  })

  it('should detect Electron environment', () => {
    const store = useSettingsStore()
    expect(typeof store.isElectron).toBe('boolean')
  })

  it('should load settings in Electron mode', async () => {
    const mockSettings = {
      wsUrl: 'ws://test:9090/astrbot/live2d',
      token: 'test-token',
      alwaysOnTop: true,
      transparent: true,
      modelScale: 1.5,
      modelX: 0,
      modelY: 0,
      windowSize: { width: 500, height: 700 },
      windowPosition: null
    }

    window.electronAPI.getSettings = vi.fn().mockResolvedValue(mockSettings)

    const store = useSettingsStore()
    await store.loadSettings()

    expect(store.settings.wsUrl).toBe('ws://test:9090/astrbot/live2d')
    expect(store.settings.token).toBe('test-token')
  })

  it('should save settings', async () => {
    window.electronAPI.setSettings = vi.fn().mockResolvedValue(undefined)

    const store = useSettingsStore()
    await store.saveSettings({ alwaysOnTop: true })

    expect(window.electronAPI.setSettings).toHaveBeenCalledWith({ alwaysOnTop: true })
  })

  it('should update single setting', async () => {
    window.electronAPI.setSettings = vi.fn().mockResolvedValue(undefined)

    const store = useSettingsStore()
    await store.updateSetting('modelScale', 2.0)

    expect(window.electronAPI.setSettings).toHaveBeenCalledWith({ modelScale: 2.0 })
  })
})
