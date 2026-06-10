/**
 * AudioLipSyncAnalyzer 测试
 * 在 node 环境下 stub Web Audio API 与 requestAnimationFrame
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Web Audio / rAF stubs
// ---------------------------------------------------------------------------

let rafQueue: Array<{ id: number; callback: FrameRequestCallback }> = []
let rafIdCounter = 0

function flushFrames(count = 1) {
  for (let i = 0; i < count; i++) {
    const pending = rafQueue
    rafQueue = []
    for (const { callback } of pending) {
      callback(performance.now())
    }
  }
}

class FakeAnalyserNode {
  fftSize = 2048
  getFloatTimeDomainData(target: Float32Array) {
    target.set(currentSamples.subarray(0, target.length))
  }
}

class FakeMediaElementSourceNode {
  connectedTo = new Set<unknown>()
  connect(node: unknown) {
    this.connectedTo.add(node)
  }
  disconnect(node: unknown) {
    if (!this.connectedTo.has(node)) {
      throw new Error('not connected')
    }
    this.connectedTo.delete(node)
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state = 'running'
  destination = { kind: 'destination' }
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  createMediaElementSourceCalls: HTMLAudioElement[] = []

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createAnalyser() {
    return new FakeAnalyserNode()
  }

  createMediaElementSource(element: HTMLAudioElement) {
    if ((element as unknown as Record<string, unknown>).__throwOnCreate) {
      throw new Error('InvalidStateError')
    }
    this.createMediaElementSourceCalls.push(element)
    return new FakeMediaElementSourceNode()
  }
}

let currentSamples = new Float32Array(2048)

function setSampleAmplitude(amplitude: number) {
  currentSamples = new Float32Array(2048).fill(amplitude)
}

function makeAudioElement(): HTMLAudioElement {
  return { tagName: 'AUDIO' } as unknown as HTMLAudioElement
}

vi.stubGlobal('AudioContext', FakeAudioContext)
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  const id = ++rafIdCounter
  rafQueue.push({ id, callback })
  return id
})
vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  rafQueue = rafQueue.filter(entry => entry.id !== id)
})

const { AudioLipSyncAnalyzer } = await import('../src/utils/AudioLipSyncAnalyzer')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioLipSyncAnalyzer', () => {
  let analyzer: InstanceType<typeof AudioLipSyncAnalyzer>
  let values: number[]
  const onValue = (value: number) => values.push(value)

  beforeEach(() => {
    analyzer = new AudioLipSyncAnalyzer()
    values = []
    rafQueue = []
    setSampleAmplitude(0)
  })

  afterEach(() => {
    analyzer.stop()
  })

  test('start 成功后进入运行状态并按帧回调', () => {
    const started = analyzer.start(makeAudioElement(), onValue)

    expect(started).toBe(true)
    expect(analyzer.isRunning).toBe(true)

    flushFrames(2)
    expect(values.length).toBe(2)
  })

  test('静音输入输出 0', () => {
    setSampleAmplitude(0)
    analyzer.start(makeAudioElement(), onValue)

    flushFrames(3)
    expect(values.every(value => value === 0)).toBe(true)
  })

  test('有声输入输出 (0, 1] 区间的值且随帧上升', () => {
    setSampleAmplitude(0.3)
    analyzer.start(makeAudioElement(), onValue)

    flushFrames(5)
    expect(values[0]).toBeGreaterThan(0)
    expect(values[4]).toBeGreaterThan(values[0])
    expect(values.every(value => value <= 1)).toBe(true)
  })

  test('低于噪声门限的输入视为静音', () => {
    setSampleAmplitude(0.005)
    analyzer.start(makeAudioElement(), onValue)

    flushFrames(3)
    expect(values.every(value => value === 0)).toBe(true)
  })

  test('stop 后回调归零并停止帧循环', () => {
    setSampleAmplitude(0.3)
    analyzer.start(makeAudioElement(), onValue)
    flushFrames(2)

    analyzer.stop()

    expect(analyzer.isRunning).toBe(false)
    expect(values[values.length - 1]).toBe(0)

    const countAfterStop = values.length
    flushFrames(2)
    expect(values.length).toBe(countAfterStop)
  })

  test('同一音频元素重复 start 时复用 MediaElementSource', () => {
    const element = makeAudioElement()
    analyzer.start(element, onValue)
    analyzer.stop()
    analyzer.start(element, onValue)
    analyzer.stop()

    const context = FakeAudioContext.instances[0]
    const callsForElement = context.createMediaElementSourceCalls.filter(el => el === element)
    expect(callsForElement.length).toBe(1)
  })

  test('createMediaElementSource 抛错时 start 返回 false 且不崩溃', () => {
    const element = makeAudioElement()
    ;(element as unknown as Record<string, unknown>).__throwOnCreate = true

    const started = analyzer.start(element, onValue)

    expect(started).toBe(false)
    expect(analyzer.isRunning).toBe(false)
  })

  test('suspended 状态的 AudioContext 会被 resume', () => {
    const context = FakeAudioContext.instances[0]
    context.state = 'suspended'

    analyzer.start(makeAudioElement(), onValue)

    expect(context.resume).toHaveBeenCalled()
  })
})
