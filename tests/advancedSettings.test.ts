import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADVANCED_SETTINGS,
  clampBubbleFollowUpWindowMs,
  clampBubbleStackMax,
  clampImageInlineThresholdKb,
  clampImageMaxSizeMb,
  clampMaxRecordingSeconds,
  normalizeAdvancedSettings,
} from '../src/utils/advancedSettings'

describe('advancedSettings', () => {
  it('clamps recording seconds into the supported range', () => {
    expect(clampMaxRecordingSeconds(0)).toBe(1)
    expect(clampMaxRecordingSeconds(999)).toBe(60)
    expect(clampMaxRecordingSeconds(15.6)).toBe(16)
  })

  it('clamps other advanced numeric settings into supported ranges', () => {
    expect(clampBubbleStackMax(0)).toBe(1)
    expect(clampBubbleStackMax(999)).toBe(10)
    expect(clampBubbleFollowUpWindowMs(100)).toBe(500)
    expect(clampBubbleFollowUpWindowMs(999999)).toBe(15000)
    expect(clampImageInlineThresholdKb(32)).toBe(64)
    expect(clampImageInlineThresholdKb(9999)).toBe(2048)
    expect(clampImageMaxSizeMb(0)).toBe(1)
    expect(clampImageMaxSizeMb(999)).toBe(50)
  })

  it('normalizes persisted settings and ignores removed wake-word fields', () => {
    const normalized = normalizeAdvancedSettings({
      recordingShortcut: 'Ctrl+Shift+R',
      autoConnect: false,
      autoLoadLastModel: false,
      themeFollowModel: false,
      lipSyncEnabled: false,
      silenceDetectionEnabled: true,
      dynamicPassThroughEnabled: false,
      bubbleStackMax: 6,
      bubbleFollowUpWindowMs: 6000,
      imageInlineThresholdKb: 512,
      imageMaxSizeMb: 15,
      showBaseEventNotifications: false,
      maxRecordingSeconds: 999,
      logLevel: 'debug',
      wakeWordEnabled: true,
      wakeKeywords: ['小助手']
    })

    expect(normalized).toEqual({
      recordingShortcut: 'Ctrl+Shift+R',
      autoConnect: false,
      autoLoadLastModel: false,
      themeFollowModel: false,
      lipSyncEnabled: false,
      silenceDetectionEnabled: true,
      dynamicPassThroughEnabled: false,
      bubbleStackMax: 6,
      bubbleFollowUpWindowMs: 6000,
      imageInlineThresholdKb: 512,
      imageMaxSizeMb: 15,
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

  it('uses defaults for newly added model behavior settings when missing', () => {
    const normalized = normalizeAdvancedSettings({
      recordingShortcut: 'Alt+R',
      autoConnect: false,
      showBaseEventNotifications: true,
      maxRecordingSeconds: 20,
      logLevel: 'info',
    })

    expect(normalized.autoLoadLastModel).toBe(true)
    expect(normalized.themeFollowModel).toBe(true)
    expect(normalized.lipSyncEnabled).toBe(true)
    expect(normalized.silenceDetectionEnabled).toBe(false)
    expect(normalized.dynamicPassThroughEnabled).toBe(true)
    expect(normalized.bubbleStackMax).toBe(3)
    expect(normalized.bubbleFollowUpWindowMs).toBe(4000)
    expect(normalized.imageInlineThresholdKb).toBe(256)
    expect(normalized.imageMaxSizeMb).toBe(10)
  })
})
