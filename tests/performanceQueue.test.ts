import { describe, expect, it } from 'vitest'

import { PerformanceQueue } from '../src/utils/PerformanceQueue'

describe('PerformanceQueue', () => {
  it('does not let a later interruptible sequence override the current non-interruptible execution', async () => {
    const queue = new PerformanceQueue()
    let started = 0
    let resolveAudio: (() => void) | null = null

    queue.onAudio(() => {
      started += 1
      return new Promise<void>((resolve) => {
        resolveAudio = resolve
      })
    })

    queue.enqueue({
      interruptible: false,
      sequence: [{ type: 'audio', url: 'first.mp3' }],
    })

    queue.enqueue({
      interruptible: true,
      sequence: [{ type: 'audio', url: 'second.mp3' }],
    })

    await Promise.resolve()
    expect(started).toBe(1)

    queue.interrupt()
    expect(queue.getStatus().interruptible).toBe(false)

    resolveAudio?.()
  })
})
