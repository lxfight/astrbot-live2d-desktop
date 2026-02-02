/**
 * 表演队列执行器
 * 按顺序执行表演序列中的各个元素
 */

export interface PerformElement {
  type: 'text' | 'motion' | 'expression' | 'audio' | 'image' | 'video' | 'delay'
  content?: string
  position?: 'top' | 'center' | 'bottom'
  duration?: number
  group?: string
  index?: number
  priority?: number
  id?: string | number
  url?: string
  volume?: number
}

export interface PerformSequence {
  sequence: PerformElement[]
  interruptible?: boolean
}

export class PerformanceQueue {
  private queue: PerformElement[] = []
  private isExecuting: boolean = false
  private currentTimeout: number | null = null
  private interruptible: boolean = true

  // 回调函数
  private onTextCallback?: (content: string, position: string, duration: number) => void
  private onMotionCallback?: (group: string, index: number, priority: number) => void
  private onExpressionCallback?: (id: string | number) => void
  private onAudioCallback?: (url: string, volume: number) => void
  private onImageCallback?: (url: string, duration: number) => void
  private onVideoCallback?: (url: string) => void

  /**
   * 设置文字显示回调
   */
  onText(callback: (content: string, position: string, duration: number) => void) {
    this.onTextCallback = callback
  }

  /**
   * 设置动作播放回调
   */
  onMotion(callback: (group: string, index: number, priority: number) => void) {
    this.onMotionCallback = callback
  }

  /**
   * 设置表情设置回调
   */
  onExpression(callback: (id: string | number) => void) {
    this.onExpressionCallback = callback
  }

  /**
   * 设置音频播放回调
   */
  onAudio(callback: (url: string, volume: number) => void) {
    this.onAudioCallback = callback
  }

  /**
   * 设置图片显示回调
   */
  onImage(callback: (url: string, duration: number) => void) {
    this.onImageCallback = callback
  }

  /**
   * 设置视频播放回调
   */
  onVideo(callback: (url: string) => void) {
    this.onVideoCallback = callback
  }

  /**
   * 添加表演序列到队列
   */
  enqueue(sequence: PerformSequence) {
    this.queue.push(...sequence.sequence)
    this.interruptible = sequence.interruptible !== false

    if (!this.isExecuting) {
      this.execute()
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
    this.queue = []
    this.isExecuting = false

    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout)
      this.currentTimeout = null
    }
  }

  /**
   * 清空队列
   */
  clear() {
    console.log('[表演队列] 清空队列')
    this.queue = []
    this.isExecuting = false

    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout)
      this.currentTimeout = null
    }
  }

  /**
   * 执行队列中的表演
   */
  private async execute() {
    if (this.isExecuting) return
    this.isExecuting = true

    while (this.queue.length > 0) {
      const element = this.queue.shift()!
      await this.executeElement(element)
    }

    this.isExecuting = false
    console.log('[表演队列] 队列执行完成')
  }

  /**
   * 执行单个表演元素
   */
  private async executeElement(element: PerformElement): Promise<void> {
    console.log('[表演队列] 执行元素:', element.type)

    switch (element.type) {
      case 'text':
        if (this.onTextCallback && element.content) {
          this.onTextCallback(
            element.content,
            element.position || 'center',
            element.duration || 3000
          )
          // 等待文字显示完成
          await this.delay(element.duration || 3000)
        }
        break

      case 'motion':
        if (this.onMotionCallback && element.group) {
          this.onMotionCallback(
            element.group,
            element.index || 0,
            element.priority || 2
          )
          // 动作播放不阻塞，立即继续
        }
        break

      case 'expression':
        if (this.onExpressionCallback && element.id !== undefined) {
          this.onExpressionCallback(element.id)
          // 表情设置不阻塞，立即继续
        }
        break

      case 'audio':
        if (this.onAudioCallback && element.url) {
          this.onAudioCallback(element.url, element.volume || 1.0)
          // 音频播放不阻塞（除非指定 duration）
          if (element.duration) {
            await this.delay(element.duration)
          }
        }
        break

      case 'image':
        if (this.onImageCallback && element.url) {
          this.onImageCallback(element.url, element.duration || 3000)
          await this.delay(element.duration || 3000)
        }
        break

      case 'video':
        if (this.onVideoCallback && element.url) {
          this.onVideoCallback(element.url)
          // 视频播放不阻塞（除非指定 duration）
          if (element.duration) {
            await this.delay(element.duration)
          }
        }
        break

      case 'delay':
        await this.delay(element.duration || 1000)
        break

      default:
        console.warn('[表演队列] 未知的元素类型:', element.type)
    }
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.currentTimeout = window.setTimeout(() => {
        this.currentTimeout = null
        resolve()
      }, ms)
    })
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      isExecuting: this.isExecuting,
      queueLength: this.queue.length,
      interruptible: this.interruptible
    }
  }
}
