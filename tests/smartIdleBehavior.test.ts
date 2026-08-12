import { describe, it, expect, beforeEach } from 'vitest'
import { SmartIdleBehavior } from '../src/utils/cubism/SmartIdleBehavior'

describe('SmartIdleBehavior', () => {
  let behavior: SmartIdleBehavior

  beforeEach(() => {
    behavior = new SmartIdleBehavior({
      blinkIntervalMin: 1,
      blinkIntervalMax: 2,
      randomMotionIntervalMin: 5,
      randomMotionIntervalMax: 10,
      timeCheckInterval: 3
    })
  })

  it('should initialize with enabled state', () => {
    expect(behavior.isEnabled()).toBe(true)
  })

  it('should generate blink events at intervals', () => {
    let events = behavior.advance(0.5)
    expect(events).toHaveLength(0)

    // 眨眼间隔随机在 [1, 2] 秒，推进到 5 秒必然至少触发一次
    events = behavior.advance(4.5)
    expect(events.some(e => e.type === 'blink')).toBe(true)
  })

  it('should generate random motion events', () => {
    const events = behavior.advance(10)
    expect(events.some(e => e.type === 'randomMotion')).toBe(true)
  })

  it('should not generate events when disabled', () => {
    behavior.setEnabled(false)
    const events = behavior.advance(20)
    expect(events).toHaveLength(0)
  })

  it('should reset timers', () => {
    behavior.advance(5)
    behavior.reset()
    const events = behavior.advance(0.5)
    expect(events).toHaveLength(0)
  })

  it('should generate time greeting events', () => {
    const behavior = new SmartIdleBehavior({
      enableTimeAwareness: true,
      timeCheckInterval: 0.1
    })

    const events = behavior.advance(0.2)
    const hasGreeting = events.some(e => e.type === 'timeGreeting')
    expect(hasGreeting).toBe(true)
  })
})
