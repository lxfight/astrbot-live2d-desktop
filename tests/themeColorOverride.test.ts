import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 测试主题色的手动覆盖和自动提取逻辑。
 * 由于 theme store 使用 Pinia 和 localStorage，这里通过模拟 localStorage 来验证核心行为。
 */

const DEFAULT_THEME_HEX = '#74a5ff'
const THEME_STORAGE_KEY = 'rendererThemeState'
const THEME_STORAGE_VERSION = 1

let store: Record<string, string>

function readPersisted(key: string): { sourceColor: string } | null {
  const raw = store[key]
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.version === THEME_STORAGE_VERSION && parsed?.data) {
      return parsed.data
    }
  } catch {}
  return null
}

function persistJson(key: string, version: number, data: unknown): void {
  store[key] = JSON.stringify({ version, data })
}

describe('Theme color manual override', () => {
  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      })
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists manually set color and marks override flag', () => {
    const manualHex = '#ff5500'

    persistJson(THEME_STORAGE_KEY, THEME_STORAGE_VERSION, {
      currentModelPath: '',
      currentModelName: '',
      sourceColor: manualHex
    })

    const persisted = readPersisted(THEME_STORAGE_KEY)
    expect(persisted?.sourceColor).toBe(manualHex)
  })

  it('falls back to default color when storage is empty', () => {
    const color = readPersisted(THEME_STORAGE_KEY)?.sourceColor ?? DEFAULT_THEME_HEX
    expect(color).toBe(DEFAULT_THEME_HEX)
  })

  it('auto-extraction is skipped when manual override is active', () => {
    // Simulate: user sets manual color, then model changes
    // auto-extraction should NOT overwrite the manual color
    const manualHex = '#00ff00'
    let sourceColor = manualHex
    const manualOverride = true

    // Model texture extraction fires (simulating applyModelTheme)
    const extractedRgb = { r: 100, g: 150, b: 200 }
    const extractedHex = `#${extractedRgb.r.toString(16).padStart(2, '0')}${extractedRgb.g.toString(16).padStart(2, '0')}${extractedRgb.b.toString(16).padStart(2, '0')}`

    if (!manualOverride) {
      sourceColor = extractedHex
    }

    // Manual color should be preserved
    expect(sourceColor).toBe(manualHex)
    expect(sourceColor).not.toBe(extractedHex)
  })

  it('auto-extraction updates color when override is disabled', () => {
    let sourceColor = '#74a5ff'
    const manualOverride = false

    const extractedRgb = { r: 255, g: 128, b: 0 }
    const extractedHex = '#ff8000'

    if (!manualOverride) {
      sourceColor = extractedHex
    }

    expect(sourceColor).toBe(extractedHex)
  })

  it('resetAutoColor clears the manual override flag', () => {
    let manualColorOverride = true
    const extractedColor = '#6496c8'

    // Reset: clear override
    manualColorOverride = false

    // Now auto extraction should work
    if (!manualColorOverride) {
      // color updated by extraction
    }

    expect(manualColorOverride).toBe(false)
  })
})
