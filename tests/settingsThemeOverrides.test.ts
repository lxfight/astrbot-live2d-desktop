/**
 * settingsAppearanceCss / settingsNaiveThemeOverrides 测试
 * 覆盖浅色/深色分支、base 参数传播与 CSS 类切换
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  applySettingsAppearanceClass,
  buildSettingsAppearanceCssVars
} from '../src/utils/settingsAppearanceCss'
import { buildSettingsNaiveThemeOverrides } from '../src/utils/settingsNaiveThemeOverrides'

describe('buildSettingsAppearanceCssVars', () => {
  test('浅色与深色返回不同变量集合', () => {
    const light = buildSettingsAppearanceCssVars('light')
    const dark = buildSettingsAppearanceCssVars('dark')

    expect(light['--settings-bg-base']).not.toBe(dark['--settings-bg-base'])
    expect(light['--color-text-primary']).not.toBe(dark['--color-text-primary'])
  })

  test('返回副本，修改结果不影响内部常量', () => {
    const light = buildSettingsAppearanceCssVars('light')
    light['--settings-bg-base'] = '#000000'

    expect(buildSettingsAppearanceCssVars('light')['--settings-bg-base']).toBe('#f0eeea')
  })

  test('两种方案覆盖相同变量键', () => {
    const lightKeys = Object.keys(buildSettingsAppearanceCssVars('light')).sort()
    const darkKeys = Object.keys(buildSettingsAppearanceCssVars('dark')).sort()

    expect(lightKeys).toEqual(darkKeys)
  })

  test('dark 方案包含暗色面板与文本变量', () => {
    const dark = buildSettingsAppearanceCssVars('dark')

    expect(dark['--settings-bg-base']).toBe('#121820')
    expect(dark['--desktop-panel-bg']).toBe('#1e2634')
    expect(dark['--color-text-primary']).toBe('#f8fafc')
  })
})

describe('applySettingsAppearanceClass', () => {
  const originalDocument = globalThis.document

  const classToggles: Array<{ name: string; force: boolean | undefined }> = []

  beforeEach(() => {
    classToggles.length = 0
    vi.stubGlobal('document', {
      documentElement: {
        classList: {
          toggle: vi.fn((name: string, force?: boolean) => {
            classToggles.push({ name, force })
          })
        }
      }
    })
  })

  afterEach(() => {
    if (originalDocument === undefined) {
      vi.unstubAllGlobals()
    } else {
      vi.stubGlobal('document', originalDocument)
    }
  })

  test('浅色只开启 color-scheme-light', () => {
    applySettingsAppearanceClass('light')

    expect(classToggles).toContainEqual({ name: 'color-scheme-light', force: true })
    expect(classToggles).toContainEqual({ name: 'color-scheme-dark', force: false })
  })

  test('深色只开启 color-scheme-dark', () => {
    applySettingsAppearanceClass('dark')

    expect(classToggles).toContainEqual({ name: 'color-scheme-light', force: false })
    expect(classToggles).toContainEqual({ name: 'color-scheme-dark', force: true })
  })

  test('document 不存在时不抛错', () => {
    vi.stubGlobal('document', undefined)

    expect(() => applySettingsAppearanceClass('light')).not.toThrow()
  })
})

describe('buildSettingsNaiveThemeOverrides', () => {
  const base = { common: { fontWeight: '400' }, Button: { borderRadius: '8px' } }

  test('保留 base 中未覆盖的字段', () => {
    const result = buildSettingsNaiveThemeOverrides('light', base)

    expect(result.common?.fontWeight).toBe('400')
    expect(result.Button?.borderRadius).toBe('8px')
  })

  test('浅色方案覆盖输入背景与文本色', () => {
    const result = buildSettingsNaiveThemeOverrides('light', base)

    expect(result.common?.inputColor).toBe('#ffffff')
    expect(result.common?.textColor1).toBe('rgba(15, 23, 42, 0.94)')
  })

  test('深色方案使用暗色输入背景与亮色文本', () => {
    const result = buildSettingsNaiveThemeOverrides('dark', base)

    expect(result.common?.inputColor).toBe('#222a38')
    expect(result.common?.textColor1).toBe('rgba(248, 250, 252, 0.96)')
    expect(result.common?.modalColor).toBe('#1e2634')
  })

  test('两组方案覆盖一致的组件键', () => {
    const light = buildSettingsNaiveThemeOverrides('light', base)
    const dark = buildSettingsNaiveThemeOverrides('dark', base)

    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
  })

  test('Input/Select 组件字段在两方案下都生成', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const result = buildSettingsNaiveThemeOverrides(scheme, base)

      expect(result.Input?.border).toContain('1px solid')
      expect(result.Input?.boxShadowFocus).toContain('--color-accent-rgb')
      expect(result.Select?.peers?.InternalSelection?.color).toBeDefined()
    }
  })

  test('空 base 时也能完整生成', () => {
    const result = buildSettingsNaiveThemeOverrides('light', {})

    expect(result.common?.textColor1).toBeDefined()
    expect(result.Tag?.borderRadius).toBe('6px')
    expect(result.Switch?.railColorActive).toBe('var(--color-accent)')
  })
})
