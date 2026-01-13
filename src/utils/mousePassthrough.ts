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
  }

  /**
   * 处理鼠标移动事件
   */
  handleMouseMove(event: MouseEvent) {
    if (!this.enabled) return

    const x = event.clientX
    const y = event.clientY

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
   * 强制设置穿透状态
   */
  forceState(state: 'intercept' | 'passthrough') {
    this.currentState = state
    const ignore = state === 'passthrough'
    window.electronAPI?.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined)
  }

  /**
   * 清理资源
   */
  destroy() {
    this.hitTester.destroy()
  }
}
