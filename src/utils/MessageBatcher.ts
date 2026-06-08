/**
 * WebSocket 消息批处理器
 * 优化高频消息处理，减少渲染压力
 */

interface BatchConfig<T> {
  maxBatchSize?: number
  maxWaitTime?: number
  processor: (messages: T[]) => void | Promise<void>
}

/**
 * 消息批处理器
 * - 合并短时间内的多条消息
 * - 减少处理函数调用次数
 * - 优化高频消息场景（如鼠标跟踪）
 */
export class MessageBatcher<T = unknown> {
  private queue: T[] = []
  private timer: number | null = null
  private processing = false

  private readonly maxBatchSize: number
  private readonly maxWaitTime: number
  private readonly processor: (messages: T[]) => void | Promise<void>

  constructor(config: BatchConfig<T>) {
    this.maxBatchSize = config.maxBatchSize ?? 10
    this.maxWaitTime = config.maxWaitTime ?? 16 // ~60fps
    this.processor = config.processor
  }

  /**
   * 添加消息到批处理队列
   */
  add(message: T): void {
    this.queue.push(message)

    // 达到批量大小立即处理
    if (this.queue.length >= this.maxBatchSize) {
      this.flush()
      return
    }

    // 启动延迟处理定时器
    if (this.timer === null) {
      this.timer = window.setTimeout(() => {
        this.flush()
      }, this.maxWaitTime)
    }
  }

  /**
   * 立即处理所有待处理消息
   */
  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.queue.length === 0 || this.processing) {
      return
    }

    const batch = this.queue.splice(0)
    this.processing = true

    Promise.resolve(this.processor(batch))
      .catch(error => {
        console.error('[消息批处理] 处理失败:', error)
      })
      .finally(() => {
        this.processing = false
      })
  }

  /**
   * 清空队列
   */
  clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.queue = []
  }

  /**
   * 获取队列长度
   */
  get pending(): number {
    return this.queue.length
  }

  /**
   * 销毁批处理器
   */
  destroy(): void {
    this.clear()
  }
}

/**
 * 节流函数 - 用于高频事件
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null
  let lastArgs: Parameters<T> | null = null

  return function (this: any, ...args: Parameters<T>) {
    lastArgs = args

    if (timeout === null) {
      timeout = window.setTimeout(() => {
        if (lastArgs !== null) {
          func.apply(this, lastArgs)
          lastArgs = null
        }
        timeout = null
      }, wait)
    }
  }
}

/**
 * 防抖函数 - 用于输入事件
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null

  return function (this: any, ...args: Parameters<T>) {
    if (timeout !== null) {
      clearTimeout(timeout)
    }

    timeout = window.setTimeout(() => {
      func.apply(this, args)
      timeout = null
    }, wait)
  }
}

/**
 * 请求动画帧节流 - 用于动画相关更新
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null
  let lastArgs: Parameters<T> | null = null

  return function (this: any, ...args: Parameters<T>) {
    lastArgs = args

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs !== null) {
          func.apply(this, lastArgs)
          lastArgs = null
        }
        rafId = null
      })
    }
  }
}
