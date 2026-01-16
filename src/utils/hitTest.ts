/**
 * 模型区域识别工具
 * 提供多种方法检测鼠标是否在 Live2D 模型区域内
 */

import type { Live2DModel } from 'pixi-live2d-display'
import type { Application } from 'pixi.js'

export interface HitTestOptions {
  alphaThreshold?: number  // Alpha 阈值（0-255），默认 10
  debounceMs?: number      // 防抖延迟（毫秒），默认 50
}

export class HitTester {
  private app: Application | null = null
  private model: Live2DModel | null = null
  private options: Required<HitTestOptions>
  private debounceTimer: number | null = null
  private lastResult: boolean = false
  private hasResult: boolean = false

  constructor(options: HitTestOptions = {}) {
    this.options = {
      alphaThreshold: options.alphaThreshold ?? 10,
      debounceMs: options.debounceMs ?? 20
    }
  }

  /**
   * 设置 PixiJS 应用实例和模型
   */
  setContext(app: Application, model: Live2DModel) {
    this.app = app
    this.model = model
    this.hasResult = false
  }

  /**
   * 方法1: 使用 PixiJS 的 hitTest
   * 利用 PixiJS 内置的交互系统进行检测
   */
  testByPixiHit(x: number, y: number): boolean {
    if (!this.app || !this.model) return false

    try {
      const point = { x, y }

      // PixiJS v8: 使用 renderer.events.rootBoundary.hitTest
      const renderer = this.app.renderer as any
      if (renderer?.events?.rootBoundary?.hitTest) {
        const hit = renderer.events.rootBoundary.hitTest(point.x, point.y)

        // 检查命中的对象是否是模型或其子对象
        if (hit) {
          let target = hit
          while (target) {
            if (target === this.model) {
              console.log(`[HitTest] PixiJS HitTest 命中 at (${x}, ${y})`)
              return true
            }
            target = target.parent as any
          }
        }
      }

      return false
    } catch (error) {
      console.warn('PixiJS hitTest failed:', error)
      return false
    }
  }

  /**
   * 方法2: 使用 Live2D 模型的 HitArea 检测
   * 利用模型定义的命中区域进行精确检测
   * 注意：忽略 'Body' 等粗糙的大区域，这些区域通常是矩形边界框
   */
  testByModelHitArea(x: number, y: number): boolean {
    if (!this.model) return false

    try {
      // 使用 pixi-live2d-display 的 hitTest 方法
      const hitAreas = this.model.internalModel?.hitTest(x, y)

      if (!hitAreas || hitAreas.length === 0) return false

      // 过滤掉粗糙的大区域（如 'Body'），这些区域通常是矩形边界框，不够精确
      const preciseAreas = hitAreas.filter((area: string) =>
        !['Body', 'body', 'BODY'].includes(area)
      )

      const isHit = preciseAreas.length > 0
      if (isHit) {
        console.log(`[HitTest] Live2D HitArea 命中: ${preciseAreas.join(', ')} at (${x}, ${y})`)
      }
      return isHit
    } catch (error) {
      console.warn('Live2D hitTest failed:', error)
      return false
    }
  }

  /**
   * 方法3: WebGL Alpha 检测 (Pixel Perfect)
   * 从渲染上下文中读取像素 Alpha 通道值
   * 需要 Application 设置 preserveDrawingBuffer: true
   */
  testByAlpha(x: number, y: number): boolean {
    if (!this.app) return false

    try {
      const renderer = this.app.renderer
      // 检查是否有 WebGL 上下文 (PixiJS v5-v7 renderer.gl, v8 renderer.gl)
      const gl = (renderer as any).gl
      
      if (!gl) {
        // Fallback: 尝试使用 Canvas 2D (如果 renderer.view 是 canvas 且 Context '2d')
        // 但通常 Pixi 使用 WebGL，这里会失败
        return false
      }

      const pixel = new Uint8Array(4)
      const resolution = renderer.resolution || 1
      
      // 注意：坐标需要乘以分辨率
      const pixelX = Math.round(x * resolution)
      const pixelY = Math.round(y * resolution)
      
      // WebGL 坐标系 Y 轴是向上的，而屏幕坐标系 Y 轴是向下的，需要翻转
      // 使用 gl.drawingBufferHeight 最准确，代表后端缓冲区的实际物理高度
      const glY = gl.drawingBufferHeight - pixelY

      // console.log(`[AlphaTest] Input:(${x},${y}) Pixel:(${pixelX},${pixelY}) GL_Y:${glY} BufH:${gl.drawingBufferHeight}`)

      // 读取 1x1 像素
      // 注意：这需要 preserveDrawingBuffer: true，否则在渲染循环外可能会读到空数据
      gl.readPixels(pixelX, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      
      const alpha = pixel[3]
      const isHit = alpha > this.options.alphaThreshold

      if (isHit) {
        // console.log(`[HitTest] Alpha Hit: ${alpha} at (${x}, ${y})`)
      }
      return isHit
    } catch (error) {
      console.warn('Alpha test failed:', error)
      return false
    }
  }

  /**
   * 综合测试方法（带防抖）
   * 按照要求：仅使用 Model Bounds 进行判断
   * 只要鼠标在模型的矩形边界内，即视为命中（不穿透）
   */
  test(x: number, y: number, callback?: (isHit: boolean) => void): void {
    // 清除之前的定时器
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = window.setTimeout(() => {
      let isHit = false
      
      if (this.model) {
        // getBounds() 获取的是模型在 Canvas 坐标系下的 AABB (Axis-Aligned Bounding Box)
        // 因为 Canvas 是全屏且与窗口对齐的，所以这可以直接与 MouseEvent 的 clientX/Y 比较
        const bounds = this.model.getBounds()
        
        if (x >= bounds.x && 
            x <= bounds.x + bounds.width && 
            y >= bounds.y && 
            y <= bounds.y + bounds.height) {
          isHit = true
        }
      }

      // 首次结果也要触发，确保穿透状态能初始化
      if (!this.hasResult || isHit !== this.lastResult) {
        this.lastResult = isHit
        this.hasResult = true
        console.log(`[HitTest] 状态变化: ${isHit ? '命中' : '未命中'} (Bounds) at (${x}, ${y})`)
        callback?.(isHit)
      }
    }, this.options.debounceMs)
  }

  /**
   * 立即测试（无防抖）
   */
  testImmediate(x: number, y: number): boolean {
    if (!this.model) return false
    
    const bounds = this.model.getBounds()
    return x >= bounds.x && 
           x <= bounds.x + bounds.width && 
           y >= bounds.y && 
           y <= bounds.y + bounds.height
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.app = null
    this.model = null
  }
}
