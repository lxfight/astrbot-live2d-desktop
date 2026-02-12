/**
 * 表演队列执行器
 * - 不同类型指令并行执行
 * - 同类型指令串行执行
 */

export type PerformElementType =
  | 'text'
  | 'motion'
  | 'expression'
  | 'audio'
  | 'tts'
  | 'image'
  | 'video'
  | 'delay'
  | 'wait'

export interface PerformElement {
  type: PerformElementType | string

  // 文字气泡
  content?: string
  position?: 'top' | 'center' | 'bottom'
  duration?: number

  // 动作
  group?: string
  index?: number
  priority?: number

  // 表情
  id?: string | number

  // 媒体
  url?: string
  inline?: string
  rid?: string
  text?: string
  volume?: number
}

export interface PerformSequence {
  sequence: PerformElement[]

  /**
   * 是否允许 perform.interrupt 中断当前序列（默认 true）
   */
  interruptible?: boolean
}

type MaybePromise<T> = T | Promise<T>

type TextCallback = (content: string, position: string, duration: number) => MaybePromise<void>

type MotionCallback = (group: string, index: number, priority: number) => MaybePromise<void>

type ExpressionCallback = (id: string | number) => MaybePromise<void>

type AudioCallback = (source: string, volume: number) => MaybePromise<void>

type ImageCallback = (source: string, duration: number) => MaybePromise<void>

type VideoCallback = (source: string, duration?: number) => MaybePromise<void>

function toNonNegativeInt(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }
  return Math.max(0, Math.floor(num))
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  const duration = toNonNegativeInt(ms, 0)
  if (duration <= 0) {
    return Promise.resolve()
  }
  if (signal?.aborted) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup()
      resolve()
    }, duration)

    const onAbort = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

async function withAbort<T>(promise: MaybePromise<T>, signal?: AbortSignal): Promise<T | undefined> {
  if (!signal) {
    return await promise
  }

  if (signal.aborted) {
    return undefined
  }

  const abortPromise = new Promise<undefined>((resolve) => {
    signal.addEventListener('abort', () => resolve(undefined), { once: true })
  })

  return await Promise.race([Promise.resolve(promise), abortPromise])
}

class SerialTaskQueue {
  private tasks: Array<(signal: AbortSignal) => MaybePromise<void>> = []
  private running = false
  private controller: AbortController | null = null
  private readonly name: string

  constructor(name: string) {
    this.name = name
  }

  enqueue(task: (signal: AbortSignal) => MaybePromise<void>) {
    this.tasks.push(task)
    void this.run()
  }

  interrupt() {
    this.tasks = []

    if (this.controller) {
      this.controller.abort()
      this.controller = null
    }
  }

  clear() {
    this.interrupt()
  }

  private async run() {
    if (this.running) {
      return
    }

    this.running = true

    try {
      while (this.tasks.length > 0) {
        const task = this.tasks.shift()!
        const controller = new AbortController()
        this.controller = controller

        try {
          await withAbort(task(controller.signal), controller.signal)
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error(`[表演队列] ${this.name} 任务执行失败:`, error)
          }
        } finally {
          if (this.controller === controller) {
            this.controller = null
          }
        }
      }
    } finally {
      this.running = false
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.tasks.length,
    }
  }
}

/**
 * 表演队列（不同类型并行，同类型串行）
 */
export class PerformanceQueue {
  private readonly dispatchQueue = new SerialTaskQueue('dispatch')
  private readonly textQueue = new SerialTaskQueue('text')
  private readonly motionQueue = new SerialTaskQueue('motion')
  private readonly expressionQueue = new SerialTaskQueue('expression')
  private readonly audioQueue = new SerialTaskQueue('audio')
  private readonly imageQueue = new SerialTaskQueue('image')
  private readonly videoQueue = new SerialTaskQueue('video')

  private interruptible: boolean = true

  private onTextCallback?: TextCallback
  private onMotionCallback?: MotionCallback
  private onExpressionCallback?: ExpressionCallback
  private onAudioCallback?: AudioCallback
  private onImageCallback?: ImageCallback
  private onVideoCallback?: VideoCallback

  /**
   * 设置文字显示回调
   */
  onText(callback: TextCallback) {
    this.onTextCallback = callback
  }

  /**
   * 设置动作播放回调
   */
  onMotion(callback: MotionCallback) {
    this.onMotionCallback = callback
  }

  /**
   * 设置表情设置回调
   */
  onExpression(callback: ExpressionCallback) {
    this.onExpressionCallback = callback
  }

  /**
   * 设置音频播放回调
   */
  onAudio(callback: AudioCallback) {
    this.onAudioCallback = callback
  }

  /**
   * 设置图片显示回调
   */
  onImage(callback: ImageCallback) {
    this.onImageCallback = callback
  }

  /**
   * 设置视频播放回调
   */
  onVideo(callback: VideoCallback) {
    this.onVideoCallback = callback
  }

  /**
   * 添加表演序列到队列
   */
  enqueue(sequence: PerformSequence) {
    this.interruptible = sequence.interruptible !== false

    for (const element of sequence.sequence) {
      this.dispatchQueue.enqueue((signal) => this.dispatchElement(element, signal))
    }
  }

  /**
   * 中断当前表演
   */
  interrupt() {
    if (!this.interruptible) {
      console.log('[表演队列] 当前表演不可中断')
      return
    }

    console.log('[表演队列] 中断表演')

    this.dispatchQueue.interrupt()
    this.textQueue.interrupt()
    this.motionQueue.interrupt()
    this.expressionQueue.interrupt()
    this.audioQueue.interrupt()
    this.imageQueue.interrupt()
    this.videoQueue.interrupt()
  }

  /**
   * 清空队列
   */
  clear() {
    console.log('[表演队列] 清空队列')

    this.dispatchQueue.clear()
    this.textQueue.clear()
    this.motionQueue.clear()
    this.expressionQueue.clear()
    this.audioQueue.clear()
    this.imageQueue.clear()
    this.videoQueue.clear()
  }

  private async dispatchElement(element: PerformElement, signal: AbortSignal): Promise<void> {
    if (signal.aborted) {
      return
    }

    const type = String(element.type)

    // wait/delay：阻塞调度队列，用于控制后续指令的派发时机
    if (type === 'wait' || type === 'delay') {
      const ms = toNonNegativeInt(element.duration, 1000)
      await sleep(ms, signal)
      return
    }

    switch (type) {
      case 'text':
        this.textQueue.enqueue(async (taskSignal) => {
          const content = element.content || ''
          if (!content || !this.onTextCallback) {
            return
          }

          const position = element.position || 'center'
          const duration = element.duration ?? 3000

          await withAbort(this.onTextCallback(content, position, duration), taskSignal)

          // 文本默认按 duration 做串行节拍；duration=0 则不阻塞后续文本
          if (duration > 0) {
            await sleep(duration, taskSignal)
          }
        })
        break

      case 'motion':
        this.motionQueue.enqueue(async (taskSignal) => {
          if (!this.onMotionCallback || !element.group) {
            return
          }

          await withAbort(
            this.onMotionCallback(element.group, element.index ?? 0, element.priority ?? 2),
            taskSignal
          )
        })
        break

      case 'expression':
        this.expressionQueue.enqueue(async (taskSignal) => {
          if (!this.onExpressionCallback || element.id === undefined) {
            return
          }

          await withAbort(this.onExpressionCallback(element.id), taskSignal)
        })
        break

      case 'audio':
      case 'tts':
        this.audioQueue.enqueue(async (taskSignal) => {
          if (!this.onAudioCallback) {
            return
          }

          const source = element.url || element.inline || element.rid || ''
          if (!source) {
            return
          }

          const volume = typeof element.volume === 'number' ? element.volume : 1.0

          await withAbort(this.onAudioCallback(source, volume), taskSignal)

          // 兼容旧协议：若显式指定 duration，则额外等待该时长
          if (element.duration !== undefined) {
            const ms = toNonNegativeInt(element.duration, 0)
            if (ms > 0) {
              await sleep(ms, taskSignal)
            }
          }
        })
        break

      case 'image':
        this.imageQueue.enqueue(async (taskSignal) => {
          if (!this.onImageCallback) {
            return
          }

          const source = element.url || element.inline || element.rid || ''
          if (!source) {
            return
          }

          const duration = element.duration ?? 3000
          await withAbort(this.onImageCallback(source, duration), taskSignal)

          if (duration > 0) {
            await sleep(duration, taskSignal)
          }
        })
        break

      case 'video':
        this.videoQueue.enqueue(async (taskSignal) => {
          if (!this.onVideoCallback) {
            return
          }

          const source = element.url || element.inline || element.rid || ''
          if (!source) {
            return
          }

          await withAbort(this.onVideoCallback(source, element.duration), taskSignal)

          if (element.duration !== undefined) {
            const ms = toNonNegativeInt(element.duration, 0)
            if (ms > 0) {
              await sleep(ms, taskSignal)
            }
          }
        })
        break

      default:
        console.warn('[表演队列] 未知的元素类型:', element.type)
    }
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    const dispatch = this.dispatchQueue.getStatus()

    return {
      isExecuting: dispatch.running,
      queueLength: dispatch.queued,
      interruptible: this.interruptible,
      queues: {
        dispatch,
        text: this.textQueue.getStatus(),
        motion: this.motionQueue.getStatus(),
        expression: this.expressionQueue.getStatus(),
        audio: this.audioQueue.getStatus(),
        image: this.imageQueue.getStatus(),
        video: this.videoQueue.getStatus(),
      },
    }
  }
}
