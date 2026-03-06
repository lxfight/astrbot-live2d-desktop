import { describe, expect, it } from 'vitest'
import { DEFAULT_ADVANCED_SETTINGS, clampMaxRecordingSeconds, normalizeAdvancedSettings } from '../src/utils/advancedSettings'

describe('advancedSettings', () => {
  it('clamps recording seconds into the supported range', () => {
    expect(clampMaxRecordingSeconds(0)).toBe(1)
    expect(clampMaxRecordingSeconds(999)).toBe(60)
    expect(clampMaxRecordingSeconds(15.6)).toBe(16)
  })

  it('normalizes persisted settings and ignores removed wake-word fields', () => {
    const normalized = normalizeAdvancedSettings({
      recordingShortcut: 'Ctrl+Shift+R',
      autoConnect: false,
      showBaseEventNotifications: false,
      maxRecordingSeconds: 999,
      logLevel: 'debug',
      wakeWordEnabled: true,
      wakeKeywords: ['小助手']
    })

    expect(normalized).toEqual({
      recordingShortcut: 'Ctrl+Shift+R',
      autoConnect: false,
      showBaseEventNotifications: false,
      maxRecordingSeconds: 60,
      logLevel: 'debug'
    })
    expect(normalized).not.toHaveProperty('wakeWordEnabled')
    expect(normalized).not.toHaveProperty('wakeKeywords')
  })

  it('falls back to defaults for invalid persisted values', () => {
    expect(normalizeAdvancedSettings({ recordingShortcut: 123, logLevel: 'trace' })).toEqual(DEFAULT_ADVANCED_SETTINGS)
  })
})
