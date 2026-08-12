/**
 * 焦点感知优化器
 *
 * 根据窗口焦点状态自动调整性能消耗：
 * - 失去焦点时降低帧率、减少动画更新
 * - 恢复焦点时恢复正常性能
 */

export interface FocusAwareConfig {
  /** 失焦时的目标帧率，默认 15 fps */
  blurredFps?: number
  /** 正常焦点时的目标帧率，默认 60 fps */
  focusedFps?: number
  /** 失焦时的空闲动画活跃度倍数，默认 0.3 */
  blurredIdleActivity?: number
  /** 失焦多久后进入省电模式（秒），默认 60 秒 */
  powerSaveDelay?: number
  /** 省电模式下的帧率，默认 5 fps */
  powerSaveFps?: number
}

export type FocusState = 'focused' | 'blurred' | 'powerSave'

export interface FocusStateChangeEvent {
  from: FocusState
  to: FocusState
  timestamp: number
}

const DEFAULT_CONFIG: Required<FocusAwareConfig> = {
  blurredFps: 15,
  focusedFps: 60,
  blurredIdleActivity: 0.3,
  powerSaveDelay: 60,
  powerSaveFps: 5
}

/**
 * 焦点感知优化器
 */
export class FocusAwareOptimizer {
  private config: Required<FocusAwareConfig>
  private enabled = true
  private state: FocusState = 'focused'
  private hasFocus = true
  private blurredTime = 0
  private stateChangeCallbacks: Array<(event: FocusStateChangeEvent) => void> = []

  constructor(config: FocusAwareConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.setState('focused')
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 更新窗口焦点状态
   */
  setFocus(hasFocus: boolean): void {
    this.hasFocus = hasFocus
    if (hasFocus) {
      this.blurredTime = 0
    }
  }

  /**
   * 获取当前焦点状态
   */
  getFocusState(): FocusState {
    return this.state
  }

  /**
   * 推进时间并更新状态
   */
  advance(deltaSeconds: number): void {
    if (!this.enabled) {
      return
    }

    const previousState = this.state

    if (!this.hasFocus) {
      this.blurredTime += deltaSeconds

      if (this.blurredTime >= this.config.powerSaveDelay && this.state !== 'powerSave') {
        this.setState('powerSave')
      } else if (this.blurredTime < this.config.powerSaveDelay && this.state !== 'blurred') {
        this.setState('blurred')
      }
    } else {
      this.blurredTime = 0
      if (this.state !== 'focused') {
        this.setState('focused')
      }
    }

    if (this.state !== previousState) {
      this.emitStateChange(previousState, this.state)
    }
  }

  /**
   * 获取当前目标帧率
   */
  getTargetFps(): number {
    if (!this.enabled) {
      return this.config.focusedFps
    }

    switch (this.state) {
      case 'focused':
        return this.config.focusedFps
      case 'blurred':
        return this.config.blurredFps
      case 'powerSave':
        return this.config.powerSaveFps
    }
  }

  /**
   * 获取当前空闲动画活跃度倍数
   */
  getIdleActivityMultiplier(): number {
    if (!this.enabled || this.state === 'focused') {
      return 1.0
    }
    return this.config.blurredIdleActivity
  }

  /**
   * 监听状态变化
   */
  onStateChange(callback: (event: FocusStateChangeEvent) => void): () => void {
    this.stateChangeCallbacks.push(callback)
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback)
      if (index !== -1) {
        this.stateChangeCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * 设置状态
   */
  private setState(newState: FocusState): void {
    this.state = newState
  }

  /**
   * 触发状态变化事件
   */
  private emitStateChange(from: FocusState, to: FocusState): void {
    const event: FocusStateChangeEvent = {
      from,
      to,
      timestamp: Date.now()
    }

    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('[FocusAwareOptimizer] State change callback error:', error)
      }
    })
  }
}
