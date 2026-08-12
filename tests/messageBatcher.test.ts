import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageBatcher, throttle, debounce, rafThrottle } from '@/utils/MessageBatcher'

/**
 * MessageBatcher 测试
 * 在 node 环境下 stub window.setTimeout 与 console.error
 */

const timers = new Map<number, () => void>()
let timerSequence = 0

function createTimerStore(): {
  setTimeout: (callback: () => void, _delay?: number) => number
  clearTimeout: (id: number) => void
} {
  return {
    setTimeout: (callback: () => void, _delay?: number) => {
      const id = ++timerSequence
      timers.set(id, callback)
      return id
    },
    clearTimeout: (id: number) => {
      timers.delete(id)
    }
  }
}

function stubTimers(): void {
  timerSequence = 0
  timers.clear()
  const store = createTimerStore()
  vi.stubGlobal('setTimeout', store.setTimeout)
  vi.stubGlobal('clearTimeout', store.clearTimeout)
  vi.stubGlobal('window', store)
}

function runAllTimers(): void {
  const callbacks = Array.from(timers.values())
  timers.clear()
  callbacks.forEach(callback => callback())
}

async function flushMicrotasks(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('MessageBatcher', () => {
  beforeEach(stubTimers)

  it('should batch messages within the wait window', () => {
    const received: number[][] = []
    const batcher = new MessageBatcher<number>({
      maxBatchSize: 10,
      maxWaitTime: 16,
      processor: batch => received.push(batch)
    })

    batcher.add(1)
    batcher.add(2)
    batcher.add(3)
    expect(batcher.pending).toBe(3)
    expect(received).toHaveLength(0)

    runAllTimers()
    expect(received).toEqual([[1, 2, 3]])
    expect(batcher.pending).toBe(0)
  })

  it('should flush immediately when batch size is reached', () => {
    const received: number[][] = []
    const batcher = new MessageBatcher<number>({
      maxBatchSize: 3,
      maxWaitTime: 16,
      processor: batch => received.push(batch)
    })

    batcher.add(1)
    batcher.add(2)
    batcher.add(3)
    expect(received).toEqual([[1, 2, 3]])
    expect(batcher.pending).toBe(0)
  })

  it('should flush immediately on demand', () => {
    const received: number[][] = []
    const batcher = new MessageBatcher<number>({
      processor: batch => received.push(batch)
    })

    batcher.add(1)
    batcher.flush()
    expect(received).toEqual([[1]])
  })

  it('should not re-process while processing is in flight', async () => {
    const received: number[][] = []
    let resolveProcessing: (() => void) | null = null
    const processingGate = new Promise<void>(resolve => {
      resolveProcessing = resolve
    })

    const batcher = new MessageBatcher<number>({
      processor: async batch => {
        received.push(batch)
        await processingGate
      }
    })

    batcher.add(1)
    batcher.flush()
    batcher.add(2)
    batcher.flush()
    expect(received).toHaveLength(1)

    resolveProcessing?.()
    await flushMicrotasks()
    batcher.flush()
    expect(received).toEqual([[1], [2]])
  })

  it('should swallow processor errors and continue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const received: number[][] = []
    let failNext = true

    const batcher = new MessageBatcher<number>({
      processor: batch => {
        if (failNext) {
          failNext = false
          throw new Error('boom')
        }
        received.push(batch)
      }
    })

    batcher.add(1)
    batcher.flush()
    await flushMicrotasks()

    batcher.add(2)
    batcher.flush()
    await flushMicrotasks()

    expect(received).toEqual([[2]])
  })

  it('should clear pending messages and timer', () => {
    const received: number[][] = []
    const batcher = new MessageBatcher<number>({
      processor: batch => received.push(batch)
    })

    batcher.add(1)
    batcher.add(2)
    batcher.clear()
    expect(batcher.pending).toBe(0)

    runAllTimers()
    expect(received).toHaveLength(0)
  })

  it('should destroy and stop processing', () => {
    const received: number[][] = []
    const batcher = new MessageBatcher<number>({
      processor: batch => received.push(batch)
    })

    batcher.add(1)
    batcher.destroy()
    runAllTimers()
    expect(received).toHaveLength(0)
    expect(batcher.pending).toBe(0)
  })
})

describe('throttle', () => {
  beforeEach(stubTimers)

  it('should invoke the wrapped function once per window', () => {
    const calls: string[] = []
    const throttled = throttle((value: string) => calls.push(value), 100)

    throttled('a')
    throttled('b')
    throttled('c')
    expect(calls).toHaveLength(0)

    runAllTimers()
    expect(calls).toEqual(['c'])

    throttled('d')
    runAllTimers()
    expect(calls).toEqual(['c', 'd'])
  })
})

describe('debounce', () => {
  beforeEach(stubTimers)

  it('should invoke only after the wait window elapses with no new calls', () => {
    const calls: string[] = []
    const debounced = debounce((value: string) => calls.push(value), 100)

    debounced('a')
    debounced('b')
    expect(calls).toHaveLength(0)

    runAllTimers()
    expect(calls).toEqual(['b'])
  })
})

describe('rafThrottle', () => {
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  let rafSequence = 0

  beforeEach(() => {
    rafSequence = 0
    rafCallbacks.clear()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++rafSequence
      rafCallbacks.set(id, callback)
      return id
    })
  })

  it('should coalesce calls within a single animation frame', () => {
    const calls: string[] = []
    const throttled = rafThrottle((value: string) => calls.push(value))

    throttled('a')
    throttled('b')
    expect(calls).toHaveLength(0)

    const callbacks = Array.from(rafCallbacks.values())
    rafCallbacks.clear()
    callbacks.forEach(callback => callback(0))
    expect(calls).toEqual(['b'])
  })
})
