/**
 * 表演队列执行器
 * - 不同类型指令并行执行
 * - 同类型指令串行执行
 */
import type { ResourceLike } from './resourceUrl'

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

type AudioCallback = (source: ResourceLike, volume: number) => MaybePromise<void>

type ImageCallback = (source: string, duration: number) => MaybePromise<void>

type VideoCallback = (source: string, duration?: number) => MaybePromise<void>

type SequenceState = {
  interruptible: boolean
  pending: number
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }
  return Math.max(0, Math.floor(num))
}

function extractResourceLike(element: PerformElement): ResourceLike | null {
  const inline = typeof element.inline === 'string' ? element.inline.trim() : ''
  const url = typeof element.url === 'string' ? element.url.trim() : ''
  const rid = typeof element.rid === 'string' ? element.rid.trim() : ''

  if (!inline && !url && !rid) {
    return null
  }

  return { inline, url, rid }
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

  private activeInterruptible = true
  private readonly sequenceStates: SequenceState[] = []
  private executionVersion = 0

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
    if (sequence.sequence.length === 0) {
      return
    }

    const sequenceState: SequenceState = {
      interruptible: sequence.interruptible !== false,
      pending: sequence.sequence.length,
    }

    this.sequenceStates.push(sequenceState)
    this.activeInterruptible = this.sequenceStates[0]?.interruptible ?? true

    const sequenceVersion = this.executionVersion

    for (const element of sequence.sequence) {
      this.dispatchQueue.enqueue((signal) => this.dispatchElement(element, signal, sequenceState, sequenceVersion))
    }
  }

  /**
   * 中断当前表演
   */
  interrupt() {
    if (!this.activeInterruptible) {
      console.log('[表演队列] 当前表演不可中断')
      return
    }

    console.log('[表演队列] 中断表演')
    this.executionVersion += 1

    this.dispatchQueue.interrupt()
    this.sequenceStates.length = 0
    this.activeInterruptible = true
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
    this.executionVersion += 1

    this.dispatchQueue.clear()
    this.sequenceStates.length = 0
    this.activeInterruptible = true
    this.textQueue.clear()
    this.motionQueue.clear()
    this.expressionQueue.clear()
    this.audioQueue.clear()
    this.imageQueue.clear()
    this.videoQueue.clear()
  }

  private completeSequenceElement(sequenceState: SequenceState) {
    sequenceState.pending = Math.max(0, sequenceState.pending - 1)
    if (sequenceState.pending > 0) {
      return
    }

    const completedIndex = this.sequenceStates.indexOf(sequenceState)
    if (completedIndex !== -1) {
      this.sequenceStates.splice(completedIndex, 1)
    }
    this.activeInterruptible = this.sequenceStates[0]?.interruptible ?? true
  }

  private async dispatchElement(
    element: PerformElement,
    signal: AbortSignal,
    sequenceState: SequenceState,
    sequenceVersion: number,
  ): Promise<void> {
    if (signal.aborted || sequenceVersion !== this.executionVersion) {
      this.completeSequenceElement(sequenceState)
      return
    }

    const type = String(element.type)

    // wait/delay：阻塞调度队列，用于控制后续指令的派发时机
    if (type === 'wait' || type === 'delay') {
      const ms = toNonNegativeInt(element.duration, 1000)
      try {
        await sleep(ms, signal)
      } finally {
        this.completeSequenceElement(sequenceState)
      }
      return
    }

    switch (type) {
      case 'text':
        this.textQueue.enqueue(async (taskSignal) => {
          try {
            if (sequenceVersion !== this.executionVersion) {
              return
            }

            const content = element.content || ''
            if (!content || !this.onTextCallback) {
              return
            }

            const position = element.position || 'center'
            const duration = element.duration ?? 3000

            await withAbort(this.onTextCallback(content, position, duration), taskSignal)

            if (duration > 0) {
              await sleep(duration, taskSignal)
            }
          } finally {
            this.completeSequenceElement(sequenceState)
          }
        })
        break

      case 'motion':
        this.motionQueue.enqueue(async (taskSignal) => {
          try {
            if (sequenceVersion !== this.executionVersion) {
              return
            }

            if (!this.onMotionCallback || !element.group) {
              return
            }

            await withAbort(
              this.onMotionCallback(element.group, element.index ?? 0, element.priority ?? 2),
              taskSignal
            )
          } finally {
            this.completeSequenceElement(sequenceState)
          }
        })
        break

      case 'expression':
        this.expressionQueue.enqueue(async (taskSignal) => {
          try {
            if (sequenceVersion !== this.executionVersion) {
              return
            }

            if (!this.onExpressionCallback || element.id === undefined) {
              return
            }

            await withAbort(this.onExpressionCallback(element.id), taskSignal)
          } finally {
            this.completeSequenceElement(sequenceState)
          }
        })
        break

      case 'audio':
      case 'tts':
        this.audioQueue.enqueue(async (taskSignal) => {
          try {
            if (sequenceVersion !== this.executionVersion) {
              return
            }

            if (!this.onAudioCallback) {
              return
            }

            const source = extractResourceLike(element)
            if (!source) {
              return
            }

            const volume = typeof element.volume === 'number' ? element.volume : 1.0

            await withAbort(this.onAudioCallback(source, volume), taskSignal)

            if (element.duration !== undefined) {
              const ms = toNonNegativeInt(element.duration, 0)
              if (ms > 0) {
                await sleep(ms, taskSignal)
              }
            }
          } finally {
            this.completeSequenceElement(sequenceState)
          }
        })
        break

      case 'image':
        this.imageQueue.enqueue(async (taskSignal) => {
          try {
            if (sequenceVersion !== this.executionVersion) {
              return
            }

            if (!this.onImageCallback) {
              return
            }

            const source = element.inline || element.rid || element.url || ''
            if (!source) {
              return
            }

            const duration = element.duration ?? 3000
            await withAbort(this.onImageCallback(source, duration), taskSignal)

            if (duration > 0) {
              await sleep(duration, taskSignal)
            }
          } finally {
            this.completeSequenceElement(sequenceState)
          }
        })
        break

      case 'video':
        this.videoQueue.enqueue(async (taskSignal) => {
          try {
            if (sequenceVersion !== this.executionVersion) {
              return
            }

            if (!this.onVideoCallback) {
              return
            }

            const source = element.inline || element.rid || element.url || ''
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
          } finally {
            this.completeSequenceElement(sequenceState)
          }
        })
        break

      default:
        console.warn('[表演队列] 未知的元素类型:', element.type)
        this.completeSequenceElement(sequenceState)
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
      interruptible: this.activeInterruptible,
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
