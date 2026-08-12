import { bench, describe } from 'vitest'
import { createThemePalette, hexToRgb, withAlpha } from '@/utils/themePalette'
import { rgbToHexString } from '@/utils/color'
import { generateMessageId } from '@/utils/id'
import { wsToHttpProtocol, deriveHttpBaseUrlFromWsUrl } from '@/utils/urlNormalize'
import { resolveWindowKindFromHash } from '@/utils/windowKind'
import { clampBubbleStackMax, normalizeAdvancedSettings } from '@/utils/advancedSettings'

const SAMPLE_RGB = { r: 116, g: 165, b: 255 }
const SAMPLE_RAW_SETTINGS = {
  recordingShortcut: 'Ctrl+Shift+R',
  autoLoadLastModel: false,
  themeFollowModel: false,
  silenceDetectionEnabled: true,
  bubbleStackMax: 6,
  bubbleFollowUpWindowMs: 6000,
  imageInlineThresholdKb: 512,
  imageMaxSizeMb: 15,
  showBaseEventNotifications: false,
  maxRecordingSeconds: 999,
  logLevel: 'debug'
}

/**
 * 核心纯函数吞吐基准。
 * 这些基准用于早期发现明显的性能退化（如 O(n^2) 回归），
 * 不作为严格的性能目标——真实渲染性能需在运行时用 PerformanceMonitor 观测。
 * 运行：pnpm bench
 */
describe('theme & color', () => {
  bench('hexToRgb', () => {
    hexToRgb('#74a5ff')
  })

  bench('rgbToHexString', () => {
    rgbToHexString(SAMPLE_RGB)
  })

  bench('createThemePalette', () => {
    createThemePalette(SAMPLE_RGB)
  })

  bench('withAlpha', () => {
    withAlpha('#74a5ff', 0.36)
  })
})

describe('ids & urls', () => {
  bench('generateMessageId', () => {
    generateMessageId('perf')
  })

  bench('deriveHttpBaseUrlFromWsUrl', () => {
    deriveHttpBaseUrlFromWsUrl('wss://example.com:9090/some/path?x=1')
  })

  bench('wsToHttpProtocol', () => {
    wsToHttpProtocol('wss:')
  })
})

describe('window & settings', () => {
  bench('resolveWindowKindFromHash', () => {
    resolveWindowKindFromHash('#/settings/advanced/behavior')
  })

  bench('normalizeAdvancedSettings', () => {
    normalizeAdvancedSettings(SAMPLE_RAW_SETTINGS)
  })

  bench('clampBubbleStackMax', () => {
    clampBubbleStackMax(999)
  })
})
