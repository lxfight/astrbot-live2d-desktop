/**
 * ModelResourceCache 测试
 * 覆盖缓存命中/未命中、过期清理、容量驱逐、预加载与全局单例
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  destroyGlobalModelResourceCache,
  getGlobalModelResourceCache,
  ModelResourceCache
} from '../src/utils/cubism/ModelResourceCache'

function makeBuffer(byteLength: number, seed = 0): ArrayBuffer {
  const buffer = new ArrayBuffer(byteLength)
  new Uint8Array(buffer).fill(seed)
  return buffer
}

describe('ModelResourceCache', () => {
  let cache: ModelResourceCache

  beforeEach(() => {
    vi.stubGlobal('window', globalThis)
    vi.useFakeTimers()
    cache = new ModelResourceCache()
  })

  afterEach(() => {
    cache.destroy()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('未命中时 get 返回 null 并累计 miss', () => {
    expect(cache.get('texture.png')).toBeNull()
    expect(cache.getStats().misses).toBe(1)
  })

  test('set 后 get 命中返回相同数据并累计 hit', () => {
    const data = makeBuffer(16, 7)
    cache.set('texture.png', data)

    expect(cache.get('texture.png')).toBe(data)
    const stats = cache.getStats()
    expect(stats.hits).toBe(1)
    expect(stats.hitRate).toBe(1)
  })

  test('过期条目返回 null 并从缓存移除', () => {
    const data = makeBuffer(16)
    cache.set('texture.png', data)
    vi.advanceTimersByTime(31 * 60 * 1000)

    expect(cache.get('texture.png')).toBeNull()
    expect(cache.getStats().count).toBe(0)
  })

  test('超过单条目上限的资源不缓存', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    cache.set('huge.png', makeBuffer(60 * 1024 * 1024)) // 超过 100MB 上限的 50%

    expect(cache.get('huge.png')).toBeNull()
    expect(cache.getStats().count).toBe(0)
    expect(warnSpy).toHaveBeenCalledOnce()
    warnSpy.mockRestore()
  })

  test('超出总容量时驱逐最旧条目', () => {
    const small = new ModelResourceCache({ maxCacheSize: 1_000_000 })
    try {
      small.set('a', makeBuffer(300_000))
      vi.advanceTimersByTime(1000)
      small.set('b', makeBuffer(300_000))
      small.set('c', makeBuffer(300_000))
      small.set('d', makeBuffer(300_000))

      expect(small.get('a')).toBeNull()
      expect(small.get('b')).not.toBeNull()
      expect(small.getStats().count).toBe(3)
    } finally {
      small.destroy()
    }
  })

  test('set 相同 URL 覆盖旧数据并修正统计', () => {
    cache.set('texture.png', makeBuffer(32))
    cache.set('texture.png', makeBuffer(8))

    const stats = cache.getStats()
    expect(stats.size).toBe(8)
    expect(stats.count).toBe(1)
  })

  test('remove 返回是否移除成功', () => {
    expect(cache.remove('missing.png')).toBe(false)

    cache.set('texture.png', makeBuffer(16))
    expect(cache.remove('texture.png')).toBe(true)
    expect(cache.getStats().count).toBe(0)
  })

  test('clear 清空缓存与体积统计但保留命中统计', () => {
    cache.set('texture.png', makeBuffer(16))
    cache.get('texture.png')
    cache.clear()

    const stats = cache.getStats()
    expect(stats.count).toBe(0)
    expect(stats.size).toBe(0)
    expect(stats.hits).toBe(1)
  })

  test('定时清理在 cleanupInterval 后移除过期条目', () => {
    cache.set('texture.png', makeBuffer(16))
    vi.advanceTimersByTime(31 * 60 * 1000)

    cache.get('missing.png') // 触发过期检查不清理其他条目
    expect(cache.getStats().count).toBe(1)

    // 等待下一次 cleanupInterval 触发
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(cache.getStats().count).toBe(0)
  })

  test('preload 拉取并缓存响应，跳过已缓存 URL', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(makeBuffer(8), { status: 200 }))

    cache.set('cached.png', makeBuffer(4))
    await cache.preload(['cached.png', 'fresh.png', 'other.png'])

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).not.toHaveBeenCalledWith('cached.png')
    expect(cache.get('fresh.png')).not.toBeNull()
    expect(cache.get('other.png')).not.toBeNull()
    fetchSpy.mockRestore()
  })

  test('preload 失败响应不缓存且不抛出', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))

    await expect(cache.preload(['missing.png'])).resolves.toBeUndefined()
    expect(cache.get('missing.png')).toBeNull()
    warnSpy.mockRestore()
  })

  test('preload 网络错误不抛出', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    await expect(cache.preload(['down.png'])).resolves.toBeUndefined()
  })

  test('destroy 停止定时清理并清空缓存', () => {
    cache.set('texture.png', makeBuffer(16))
    cache.destroy()

    expect(cache.getStats().count).toBe(0)
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(cache.getStats().count).toBe(0)
  })
})

describe('全局单例', () => {
  beforeEach(() => {
    vi.stubGlobal('window', globalThis)
  })

  afterEach(() => {
    destroyGlobalModelResourceCache()
    vi.unstubAllGlobals()
  })

  test('getGlobalModelResourceCache 返回同一实例', () => {
    const first = getGlobalModelResourceCache()
    const second = getGlobalModelResourceCache()

    expect(first).toBe(second)
  })

  test('destroyGlobalModelResourceCache 销毁并允许重建', () => {
    const first = getGlobalModelResourceCache()
    destroyGlobalModelResourceCache()

    const second = getGlobalModelResourceCache()
    expect(second).not.toBe(first)
  })
})
