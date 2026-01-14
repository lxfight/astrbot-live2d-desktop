/**
 * 智能鼠标穿透管理器
 * 根据模型区域识别结果，动态控制窗口鼠标穿透状态
 */

import { HitTester } from './hitTest'

export interface MousePassthroughOptions {
  enabled?: boolean      // 是否启用智能穿透，默认 true
  alphaThreshold?: number
  debounceMs?: number
}

export class MousePassthroughManager {
  private hitTester: HitTester
  private enabled: boolean
  private currentState: 'intercept' | 'passthrough' = 'intercept'
  private lockedState: 'intercept' | 'passthrough' | null = null
  private pollTimer: number | null = null
  private pollInFlight: boolean = false
  private hoverStart: number | null = null
  private lastCursor: { x: number; y: number } | null = null
  private lastMoveTime: number = 0
  private readonly pollIntervalMs = 80
  private readonly enterDelayMs = 80
  private readonly settleMs = 80
  private readonly moveThreshold = 1.5

  constructor(options: MousePassthroughOptions = {}) {
    this.enabled = options.enabled ?? true
    this.hitTester = new HitTester({
      alphaThreshold: options.alphaThreshold,
      debounceMs: options.debounceMs
    })
  }

  /**
   * 设置 PixiJS 上下文
   */
  setContext(app: any, model: any) {
    this.hitTester.setContext(app, model)
    this.lastCursor = null
    this.hoverStart = null
  }

  /**
   * 处理鼠标移动事件
   */
  handleMouseMove(event: MouseEvent) {
    if (!this.enabled) return
    if (this.lockedState) return

    const x = event.clientX
    const y = event.clientY
    if (this.currentState === 'passthrough') return

    // 使用 HitTester 检测，结果变化时会触发回调
    this.hitTester.test(x, y, (isHit) => {
      this.updatePassthroughState(isHit)
    })
  }

  /**
   * 更新穿透状态
   */
  private updatePassthroughState(isHit: boolean) {
    const newState = isHit ? 'intercept' : 'passthrough'

    // 状态无变化时不调用 IPC
    if (newState === this.currentState) return

    this.currentState = newState

    // 调用 Electron IPC 更新窗口穿透状态
    if (window.electronAPI?.setIgnoreMouseEvents) {
      const ignore = newState === 'passthrough'
      window.electronAPI.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined)

      console.log(`[MousePassthrough] ${ignore ? '🔓 穿透模式' : '🔒 拦截模式'}`)
    }

    if (newState === 'passthrough') {
      this.hoverStart = null
      this.startPolling()
    } else {
      this.stopPolling()
    }
  }

  /**
   * 启用/禁用智能穿透
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled

    // 禁用时恢复为拦截模式
    if (!enabled && this.currentState === 'passthrough') {
      this.updatePassthroughState(true)
    }
  }

  /**
   * 锁定穿透状态（用于外部拖拽等场景）
   */
  lock(state: 'intercept' | 'passthrough') {
    this.lockedState = state
    this.hoverStart = null
    this.updatePassthroughState(state === 'intercept')
  }

  /**
   * 解除锁定并根据当前鼠标位置恢复状态
   */
  unlock(event?: MouseEvent) {
    if (!this.lockedState) return
    this.lockedState = null
    this.hoverStart = null
    if (event) {
      this.handleMouseMove(event)
    }
  }

  /**
   * 强制设置穿透状态
   */
  forceState(state: 'intercept' | 'passthrough') {
    this.currentState = state
    const ignore = state === 'passthrough'
    window.electronAPI?.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined)
    if (state === 'passthrough') {
      this.hoverStart = null
      this.startPolling()
    } else {
      this.stopPolling()
    }
  }

  private recordCursorMove(x: number, y: number) {
    if (this.lastCursor) {
      const dx = x - this.lastCursor.x
      const dy = y - this.lastCursor.y
      if (Math.hypot(dx, dy) > this.moveThreshold) {
        this.lastMoveTime = Date.now()
      }
    } else {
      this.lastMoveTime = Date.now()
    }
    this.lastCursor = { x, y }
  }

  private startPolling() {
    if (this.pollTimer !== null) return
    this.pollTimer = window.setInterval(() => {
      void this.pollCursor()
    }, this.pollIntervalMs)
  }

  private stopPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async pollCursor() {
    if (this.pollInFlight) return
    if (this.lockedState) return
    if (!this.enabled || this.currentState !== 'passthrough') return
    if (!window.electronAPI?.getCursorPosition || !window.electronAPI?.getWindowPosition) return

    this.pollInFlight = true
    try {
      const [cursor, winPos] = await Promise.all([
        window.electronAPI.getCursorPosition(),
        window.electronAPI.getWindowPosition()
      ])

      const localX = cursor.x - winPos.x
      const localY = cursor.y - winPos.y
      this.recordCursorMove(localX, localY)

      const isHit = this.hitTester.testImmediate(localX, localY)
      if (!isHit) {
        this.hoverStart = null
        return
      }

      const now = Date.now()
      if (this.hoverStart === null) {
        this.hoverStart = now
        return
      }

      const settled = now - this.lastMoveTime >= this.settleMs
      const waited = now - this.hoverStart >= this.enterDelayMs
      if (settled && waited) {
        this.updatePassthroughState(true)
      }
    } finally {
      this.pollInFlight = false
    }
  }

  /**
   * 清理资源
   */
  destroy() {
    this.stopPolling()
    this.hitTester.destroy()
  }
}
