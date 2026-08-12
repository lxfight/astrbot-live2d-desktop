/**
 * windowKind 测试
 * 覆盖路由 hash 到窗口类型的解析，以及 body 类名切换
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { applyWindowKindClasses, resolveWindowKindFromHash } from '../src/utils/windowKind'

describe('resolveWindowKindFromHash', () => {
  test('识别 /settings、/history、/welcome 前缀', () => {
    expect(resolveWindowKindFromHash('#/settings')).toBe('settings')
    expect(resolveWindowKindFromHash('#/settings/connection')).toBe('settings')
    expect(resolveWindowKindFromHash('#/history')).toBe('history')
    expect(resolveWindowKindFromHash('#/welcome')).toBe('welcome')
  })

  test('识别主窗口：/main、根路径、空值', () => {
    expect(resolveWindowKindFromHash('#/main')).toBe('main')
    expect(resolveWindowKindFromHash('#/')).toBe('main')
    expect(resolveWindowKindFromHash('')).toBe('main')
  })

  test('无 # 前缀时同样解析', () => {
    expect(resolveWindowKindFromHash('/settings')).toBe('settings')
    expect(resolveWindowKindFromHash('/main')).toBe('main')
  })

  test('未知路径返回 unknown', () => {
    expect(resolveWindowKindFromHash('#/somewhere-else')).toBe('unknown')
  })
})

describe('applyWindowKindClasses', () => {
  const removed: string[] = []
  const added: string[] = []

  function makeClassList(owner: { tag: string }) {
    return {
      remove(...names: string[]) {
        removed.push(...names.map(name => `${owner.tag}:${name}`))
      },
      add(...names: string[]) {
        added.push(...names.map(name => `${owner.tag}:${name}`))
      }
    }
  }

  const documentElement = { tag: 'html', classList: makeClassList({ tag: 'html' }) }
  const body = {
    tag: 'body',
    classList: makeClassList({ tag: 'body' }),
    dataset: {} as Record<string, string | undefined>
  }

  const originalDocument = globalThis.document

  beforeEach(() => {
    removed.length = 0
    added.length = 0
    body.dataset.windowKind = undefined
    vi.stubGlobal('document', {
      documentElement,
      body
    })
  })

  afterEach(() => {
    if (originalDocument === undefined) {
      vi.unstubAllGlobals()
    } else {
      vi.stubGlobal('document', originalDocument)
    }
  })

  test('为 html 和 body 都应用 window-kind 类名并写入 dataset', () => {
    applyWindowKindClasses('settings')

    expect(added).toContain('html:window-kind-settings')
    expect(added).toContain('body:window-kind-settings')
    expect(body.dataset.windowKind).toBe('settings')
  })

  test('切换类型时移除全部旧类名', () => {
    applyWindowKindClasses('main')
    applyWindowKindClasses('history')

    for (const kind of ['main', 'settings', 'history', 'welcome', 'unknown']) {
      expect(removed).toContain(`html:window-kind-${kind}`)
      expect(removed).toContain(`body:window-kind-${kind}`)
    }
    expect(added.filter(entry => entry === 'body:window-kind-history').length).toBe(1)
  })
})
