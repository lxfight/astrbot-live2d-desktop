import { describe, it, expect, beforeEach } from 'vitest'
import { FocusAwareOptimizer } from '../src/utils/FocusAwareOptimizer'

describe('FocusAwareOptimizer', () => {
  let optimizer: FocusAwareOptimizer

  beforeEach(() => {
    optimizer = new FocusAwareOptimizer({
      blurredFps: 15,
      focusedFps: 60,
      powerSaveDelay: 10,
      powerSaveFps: 5
    })
  })

  it('should initialize in focused state', () => {
    expect(optimizer.getFocusState()).toBe('focused')
    expect(optimizer.getTargetFps()).toBe(60)
  })

  it('should transition to blurred state when focus is lost', () => {
    optimizer.setFocus(false)
    optimizer.advance(1)
    expect(optimizer.getFocusState()).toBe('blurred')
    expect(optimizer.getTargetFps()).toBe(15)
  })

  it('should transition to power save state after delay', () => {
    optimizer.setFocus(false)
    optimizer.advance(11)
    expect(optimizer.getFocusState()).toBe('powerSave')
    expect(optimizer.getTargetFps()).toBe(5)
  })

  it('should return to focused state when focus is regained', () => {
    optimizer.setFocus(false)
    optimizer.advance(11)
    expect(optimizer.getFocusState()).toBe('powerSave')

    optimizer.setFocus(true)
    optimizer.advance(0.1)
    expect(optimizer.getFocusState()).toBe('focused')
    expect(optimizer.getTargetFps()).toBe(60)
  })

  it('should reduce idle activity when blurred', () => {
    expect(optimizer.getIdleActivityMultiplier()).toBe(1.0)

    optimizer.setFocus(false)
    optimizer.advance(1)
    expect(optimizer.getIdleActivityMultiplier()).toBeLessThan(1.0)
  })

  it('should not change state when disabled', () => {
    optimizer.setEnabled(false)
    optimizer.setFocus(false)
    optimizer.advance(20)
    expect(optimizer.getFocusState()).toBe('focused')
    expect(optimizer.getTargetFps()).toBe(60)
  })

  it('should emit state change events', () => {
    let stateChanges = 0
    optimizer.onStateChange(() => {
      stateChanges++
    })

    optimizer.setFocus(false)
    optimizer.advance(1)
    expect(stateChanges).toBe(1)

    optimizer.advance(10)
    expect(stateChanges).toBe(2)

    optimizer.setFocus(true)
    optimizer.advance(0.1)
    expect(stateChanges).toBe(3)
  })

  it('should support unsubscribing from state changes', () => {
    let stateChanges = 0
    const unsubscribe = optimizer.onStateChange(() => {
      stateChanges++
    })

    optimizer.setFocus(false)
    optimizer.advance(1)
    expect(stateChanges).toBe(1)

    unsubscribe()

    optimizer.setFocus(true)
    optimizer.advance(0.1)
    expect(stateChanges).toBe(1)
  })
})
