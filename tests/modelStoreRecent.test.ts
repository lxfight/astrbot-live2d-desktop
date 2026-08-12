import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/**
 * model store 最近使用历史测试
 * 在 node 环境下 stub localStorage
 */

const storage = new Map<string, string>()

function stubLocalStorage(): void {
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    }
  })
}

beforeEach(() => {
  stubLocalStorage()
  setActivePinia(createPinia())
})

import { useModelStore } from '@/stores/model'

describe('model store recent paths', () => {
  it('records recently used models in order', () => {
    const store = useModelStore()

    store.setCurrentModel('/models/alpha')
    store.setCurrentModel('/models/beta')
    store.setCurrentModel('/models/gamma')

    expect(store.getRecentModelPaths()).toEqual(['/models/gamma', '/models/beta', '/models/alpha'])
  })

  it('deduplicates repeated usage by moving to front', () => {
    const store = useModelStore()

    store.setCurrentModel('/models/alpha')
    store.setCurrentModel('/models/beta')
    store.setCurrentModel('/models/alpha')

    expect(store.getRecentModelPaths()).toEqual(['/models/alpha', '/models/beta'])
  })

  it('caps the list at 10 entries', () => {
    const store = useModelStore()

    for (let i = 1; i <= 15; i++) {
      store.setCurrentModel(`/models/m${i}`)
    }

    const recent = store.getRecentModelPaths()
    expect(recent).toHaveLength(10)
    expect(recent[0]).toBe('/models/m15')
    expect(recent[9]).toBe('/models/m6')
  })

  it('removes entries on demand', () => {
    const store = useModelStore()

    store.setCurrentModel('/models/alpha')
    store.setCurrentModel('/models/beta')
    store.removeRecentModel('/models/alpha')

    expect(store.getRecentModelPaths()).toEqual(['/models/beta'])
  })

  it('persists across store instances', () => {
    const first = useModelStore()
    first.setCurrentModel('/models/alpha')
    first.setCurrentModel('/models/beta')

    // 模拟重新加载：新 pinia + 新 store 实例
    setActivePinia(createPinia())
    const second = useModelStore()

    expect(second.getRecentModelPaths()).toEqual(['/models/beta', '/models/alpha'])
  })

  it('does not record empty paths', () => {
    const store = useModelStore()
    store.setCurrentModel('')

    expect(store.getRecentModelPaths()).toEqual([])
  })
})
