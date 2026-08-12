import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PerformanceMonitor,
  PerformanceMark,
  getGlobalPerformanceMonitor,
  destroyGlobalPerformanceMonitor
} from '@/utils/PerformanceMonitor'

describe('PerformanceMonitor', () => {
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  let rafSequence = 0
  let nowValue = 1000

  beforeEach(() => {
    rafSequence = 0
    rafCallbacks.clear()
    nowValue = 1000

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++rafSequence
      rafCallbacks.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id)
    })
    vi.spyOn(performance, 'now').mockImplementation(() => nowValue)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    destroyGlobalPerformanceMonitor()
  })

  function runFrames(count: number, deltaPerFrame = 16.67): void {
    for (let i = 0; i < count; i++) {
      nowValue += deltaPerFrame
      const callbacks = Array.from(rafCallbacks.values())
      rafCallbacks.clear()
      callbacks.forEach(callback => callback(nowValue))
    }
  }

  it('starts and stops frame monitoring', () => {
    const monitor = new PerformanceMonitor()
    monitor.start()
    expect(rafCallbacks.size).toBe(1)

    monitor.stop()
    expect(rafCallbacks.size).toBe(0)

    // 第二次 start 后没有残留回调
    monitor.start()
    expect(rafCallbacks.size).toBe(1)
    monitor.stop()
  })

  it('tracks average fps from frame history', () => {
    const monitor = new PerformanceMonitor()
    monitor.start()
    runFrames(30, 16.67)

    expect(monitor.getAverageFPS()).toBeGreaterThan(50)
    expect(monitor.getAverageFPS()).toBeLessThan(70)

    monitor.stop()
  })

  it('returns 0 fps when no frames recorded', () => {
    const monitor = new PerformanceMonitor()
    expect(monitor.getAverageFPS()).toBe(0)
  })

  it('records and filters metrics', () => {
    const monitor = new PerformanceMonitor()
    monitor.recordMetric('render', 12, 'ms')
    monitor.recordMetric('render', 15, 'ms')
    monitor.recordMetric('load', 800, 'ms')

    expect(monitor.getMetrics()).toHaveLength(3)
    expect(monitor.getMetrics('render')).toHaveLength(2)
    expect(monitor.getMetrics('missing')).toHaveLength(0)

    monitor.clearMetrics()
    expect(monitor.getMetrics()).toHaveLength(0)
  })

  it('trims metrics beyond 1000 entries', () => {
    const monitor = new PerformanceMonitor()
    for (let i = 0; i < 1100; i++) {
      monitor.recordMetric('tick', i)
    }

    const metrics = monitor.getMetrics()
    expect(metrics).toHaveLength(1000)
    expect(metrics[0].value).toBe(100)
  })

  it('returns null memory when unavailable', () => {
    const monitor = new PerformanceMonitor()
    expect(monitor.getMemoryUsage()).toBeNull()
  })

  it('subscribe returns unsubscribe function', () => {
    const monitor = new PerformanceMonitor()
    const listener = vi.fn()
    const unsubscribe = monitor.subscribe(listener)

    unsubscribe()
    expect(listener).not.toHaveBeenCalled()

    // unsubscribe 重复调用安全
    unsubscribe()
  })

  it('notifies listeners with snapshot including memory', () => {
    const monitor = new PerformanceMonitor()
    const perfWithMemory = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
    }
    perfWithMemory.memory = {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 80 * 1024 * 1024,
      jsHeapSizeLimit: 200 * 1024 * 1024
    }

    const listener = vi.fn()
    monitor.subscribe(listener)
    monitor.start()
    runFrames(60)
    monitor.stop()

    expect(listener).toHaveBeenCalledTimes(1)
    const snapshot = listener.mock.calls[0][0] as {
      fps: number
      memory: { used: number; total: number; limit: number }
    }
    expect(snapshot.fps).toBeGreaterThan(0)
    expect(snapshot.memory.used).toBe(50 * 1024 * 1024)

    delete perfWithMemory.memory
  })

  it('swallows listener errors', () => {
    const monitor = new PerformanceMonitor()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const perfWithMemory = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
    }
    perfWithMemory.memory = {
      usedJSHeapSize: 1,
      totalJSHeapSize: 2,
      jsHeapSizeLimit: 4
    }

    monitor.subscribe(() => {
      throw new Error('listener boom')
    })
    const healthyListener = vi.fn()
    monitor.subscribe(healthyListener)

    monitor.start()
    runFrames(60)
    monitor.stop()

    expect(healthyListener).toHaveBeenCalled()
    delete perfWithMemory.memory
  })

  it('destroy clears state', () => {
    const monitor = new PerformanceMonitor()
    monitor.recordMetric('x', 1)
    monitor.subscribe(() => {})
    monitor.destroy()

    expect(monitor.getMetrics()).toHaveLength(0)
    expect(monitor.getAverageFPS()).toBe(0)
  })
})

describe('PerformanceMark', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('measures duration between start and end', () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1032)

    const mark = new PerformanceMark()
    mark.start('render')
    expect(mark.end('render')).toBe(32)

    // 重复 end 返回 0 并告警
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(mark.end('render')).toBe(0)
  })

  it('endAndLog warns above threshold only', () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1010)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const mark = new PerformanceMark()
    mark.start('fast')
    mark.endAndLog('fast', 16)
    expect(console.warn).not.toHaveBeenCalled()

    vi.spyOn(performance, 'now').mockReturnValueOnce(2000).mockReturnValueOnce(2100)
    mark.start('slow')
    mark.endAndLog('slow', 16)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('clear removes all marks', () => {
    const mark = new PerformanceMark()
    mark.start('a')
    mark.clear()
    expect(mark.end('a')).toBe(0)
  })
})

describe('global monitor', () => {
  it('returns shared instance', () => {
    const first = getGlobalPerformanceMonitor()
    const second = getGlobalPerformanceMonitor()
    expect(first).toBe(second)
  })

  it('destroy resets global instance', () => {
    const first = getGlobalPerformanceMonitor()
    destroyGlobalPerformanceMonitor()
    const second = getGlobalPerformanceMonitor()
    expect(second).not.toBe(first)
    destroyGlobalPerformanceMonitor()
  })
})
