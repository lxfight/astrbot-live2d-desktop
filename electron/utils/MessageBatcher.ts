/**
 * MessageBatcher - Node.js 版本
 *
 * 批处理高频消息，减少网络开销。
 * 用于主进程的 WebSocket 通信。
 */

export interface BatcherOptions {
  maxBatchSize?: number
  flushIntervalMs?: number
}

export interface BatchableMessage {
  type: string
  data: unknown
  timestamp: number
}

export class MessageBatcher<T extends BatchableMessage = BatchableMessage> {
  private queue: T[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private readonly maxBatchSize: number
  private readonly flushIntervalMs: number
  private readonly sendFn: (messages: T[]) => void

  constructor(sendFn: (messages: T[]) => void, options: BatcherOptions = {}) {
    this.sendFn = sendFn
    this.maxBatchSize = options.maxBatchSize ?? 10
    this.flushIntervalMs = options.flushIntervalMs ?? 50
  }

  push(message: T): void {
    this.queue.push(message)

    if (this.queue.length >= this.maxBatchSize) {
      this.flush()
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs)
    }
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (this.queue.length === 0) {
      return
    }

    const batch = this.queue.splice(0, this.queue.length)
    this.sendFn(batch)
  }

  destroy(): void {
    this.flush()
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  get queueSize(): number {
    return this.queue.length
  }
}
