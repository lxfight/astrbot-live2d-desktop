/**
 * 性能监控工具
 * 用于监控应用运行时性能指标
 */

// Chrome 特有的内存 API 类型扩展
interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface PerformanceWithMemory extends Performance {
  memory?: MemoryInfo
}

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  unit?: string
}

interface PerformanceSnapshot {
  fps: number
  memory: {
    used: number
    total: number
    limit: number
  }
  renderTime: number
  timestamp: number
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000
  private fpsHistory: number[] = []
  private lastFrameTime = 0
  private frameCount = 0
  private rafId: number | null = null
  private listeners: Array<(snapshot: PerformanceSnapshot) => void> = []

  constructor() {
    this.lastFrameTime = performance.now()
  }

  /**
   * 开始监控
   */
  start(): void {
    if (this.rafId !== null) return

    const measure = () => {
      const now = performance.now()
      const delta = now - this.lastFrameTime

      if (delta > 0) {
        const fps = 1000 / delta
        this.fpsHistory.push(fps)

        // 保持最近100帧的记录
        if (this.fpsHistory.length > 100) {
          this.fpsHistory.shift()
        }
      }

      this.lastFrameTime = now
      this.frameCount++

      // 每60帧报告一次
      if (this.frameCount >= 60) {
        this.reportSnapshot()
        this.frameCount = 0
      }

      this.rafId = requestAnimationFrame(measure)
    }

    this.rafId = requestAnimationFrame(measure)
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /**
   * 记录指标
   */
  recordMetric(name: string, value: number, unit?: string): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      unit
    })

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }
  }

  /**
   * 获取平均 FPS
   */
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0)
    return sum / this.fpsHistory.length
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): PerformanceSnapshot['memory'] | null {
    const perf = performance as PerformanceWithMemory
    if (!perf.memory) return null

    return {
      used: perf.memory.usedJSHeapSize,
      total: perf.memory.totalJSHeapSize,
      limit: perf.memory.jsHeapSizeLimit
    }
  }

  /**
   * 订阅性能快照
   */
  subscribe(listener: (snapshot: PerformanceSnapshot) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 报告性能快照
   */
  private reportSnapshot(): void {
    const memory = this.getMemoryUsage()
    if (!memory) return

    const snapshot: PerformanceSnapshot = {
      fps: this.getAverageFPS(),
      memory,
      renderTime: performance.now(),
      timestamp: Date.now()
    }

    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch (error) {
        console.error('[性能监控] 监听器执行失败:', error)
      }
    }
  }

  /**
   * 获取所有指标
   */
  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(m => m.name === name)
    }
    return [...this.metrics]
  }

  /**
   * 清除指标
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stop()
    this.listeners = []
    this.metrics = []
    this.fpsHistory = []
  }
}

/**
 * 性能标记工具
 */
export class PerformanceMark {
  private marks = new Map<string, number>()

  /**
   * 标记开始
   */
  start(name: string): void {
    this.marks.set(name, performance.now())
  }

  /**
   * 标记结束并返回耗时
   */
  end(name: string): number {
    const startTime = this.marks.get(name)
    if (!startTime) {
      console.warn(`[性能标记] 未找到标记: ${name}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.marks.delete(name)
    return duration
  }

  /**
   * 标记结束并记录日志
   */
  endAndLog(name: string, threshold = 16): void {
    const duration = this.end(name)
    if (duration > threshold) {
      console.warn(`[性能警告] ${name} 耗时 ${duration.toFixed(2)}ms (阈值: ${threshold}ms)`)
    }
  }

  /**
   * 清除所有标记
   */
  clear(): void {
    this.marks.clear()
  }
}

// 全局性能监控实例
let globalMonitor: PerformanceMonitor | null = null

export function getGlobalPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor()
  }
  return globalMonitor
}

export function destroyGlobalPerformanceMonitor(): void {
  if (globalMonitor) {
    globalMonitor.destroy()
    globalMonitor = null
  }
}
