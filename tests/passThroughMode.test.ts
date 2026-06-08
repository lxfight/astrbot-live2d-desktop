import { describe, expect, it } from 'vitest'

/**
 * 测试穿透模式 Radio 组的映射逻辑。
 * Radio 组有三个选项 (none/dynamic/full)，映射到 fullPassThrough 和 dynamicPassThrough 两个布尔值。
 */

type PassThroughMode = 'none' | 'dynamic' | 'full'

interface PassThroughSettings {
  fullPassThrough: boolean
  dynamicPassThrough: boolean
}

function computePassThroughMode(settings: PassThroughSettings): PassThroughMode {
  if (settings.fullPassThrough) return 'full'
  if (settings.dynamicPassThrough) return 'dynamic'
  return 'none'
}

function applyPassThroughMode(
  mode: PassThroughMode,
  current: PassThroughSettings
): PassThroughSettings {
  switch (mode) {
    case 'full':
      return { ...current, fullPassThrough: true, dynamicPassThrough: false }
    case 'dynamic':
      return { ...current, fullPassThrough: false, dynamicPassThrough: true }
    default:
      return { ...current, fullPassThrough: false, dynamicPassThrough: false }
  }
}

describe('Pass-through mode mapping', () => {
  it('compute: none mode when both flags are false', () => {
    expect(computePassThroughMode({ fullPassThrough: false, dynamicPassThrough: false })).toBe(
      'none'
    )
  })

  it('compute: dynamic mode when only dynamicPassThrough is true', () => {
    expect(computePassThroughMode({ fullPassThrough: false, dynamicPassThrough: true })).toBe(
      'dynamic'
    )
  })

  it('compute: full mode when fullPassThrough is true (regardless of dynamic)', () => {
    expect(computePassThroughMode({ fullPassThrough: true, dynamicPassThrough: false })).toBe(
      'full'
    )
    expect(computePassThroughMode({ fullPassThrough: true, dynamicPassThrough: true })).toBe('full')
  })

  it('apply: setting none mode disables both pass-through flags', () => {
    const result = applyPassThroughMode('none', { fullPassThrough: true, dynamicPassThrough: true })
    expect(result.fullPassThrough).toBe(false)
    expect(result.dynamicPassThrough).toBe(false)
  })

  it('apply: setting dynamic mode enables dynamic only', () => {
    const result = applyPassThroughMode('dynamic', {
      fullPassThrough: true,
      dynamicPassThrough: false
    })
    expect(result.fullPassThrough).toBe(false)
    expect(result.dynamicPassThrough).toBe(true)
  })

  it('apply: setting full mode enables full only', () => {
    const result = applyPassThroughMode('full', {
      fullPassThrough: false,
      dynamicPassThrough: true
    })
    expect(result.fullPassThrough).toBe(true)
    expect(result.dynamicPassThrough).toBe(false)
  })

  it('apply: preserves other settings when switching modes', () => {
    const result = applyPassThroughMode('dynamic', {
      fullPassThrough: false,
      dynamicPassThrough: false
    })
    expect(result.dynamicPassThrough).toBe(true)
    expect(result.fullPassThrough).toBe(false)
  })

  it('round-trip: applying a mode then computing it returns the same mode', () => {
    for (const mode of ['none', 'dynamic', 'full'] as PassThroughMode[]) {
      const applied = applyPassThroughMode(mode, {
        fullPassThrough: false,
        dynamicPassThrough: false
      })
      const computed = computePassThroughMode(applied)
      expect(computed).toBe(mode)
    }
  })
})
