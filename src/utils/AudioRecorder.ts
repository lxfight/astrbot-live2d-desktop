/**
 * 音频录制工具类
 * 使用 MediaRecorder API 录制音频
 */

export interface AudioRecorderOptions {
  sampleRate?: number // 采样率，默认 16000
  channelCount?: number // 声道数，默认 1（单声道）
  mimeType?: string // MIME 类型
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null
  private startTime: number = 0
  private options: AudioRecorderOptions

  constructor(options: AudioRecorderOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate || 16000,
      channelCount: options.channelCount || 1,
      mimeType: options.mimeType || this.getSupportedMimeType()
    }
  }

  /**
   * 获取浏览器支持的 MIME 类型
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return 'audio/webm' // 默认
  }

  /**
   * 开始录音
   */
  async start(): Promise<void> {
    try {
      // 请求麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.options.channelCount,
          sampleRate: this.options.sampleRate,
          echoCancellation: true, // 回声消除
          noiseSuppression: true, // 噪音抑制
          autoGainControl: true // 自动增益
        }
      })

      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.options.mimeType
      })

      this.audioChunks = []
      this.startTime = Date.now()

      // 监听数据
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      // 开始录音
      this.mediaRecorder.start()
      console.log('[AudioRecorder] 开始录音，MIME 类型:', this.options.mimeType)
    } catch (error) {
      console.error('[AudioRecorder] 启动录音失败:', error)
      throw new Error('无法访问麦克风，请检查权限设置')
    }
  }

  /**
   * 停止录音并返回音频 Blob
   */
  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('录音未开始'))
        return
      }

      if (this.mediaRecorder.state === 'inactive') {
        reject(new Error('录音已停止'))
        return
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: this.options.mimeType })
        console.log('[AudioRecorder] 录音完成，大小:', blob.size, '字节')
        this.cleanup()
        resolve(blob)
      }

      this.mediaRecorder.stop()
    })
  }

  /**
   * 取消录音
   */
  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    this.audioChunks = []
    this.cleanup()
    console.log('[AudioRecorder] 录音已取消')
  }

  /**
   * 获取录音状态
   */
  getState(): 'inactive' | 'recording' | 'paused' {
    if (!this.mediaRecorder) return 'inactive'
    return this.mediaRecorder.state
  }

  /**
   * 获取录音时长（毫秒）
   */
  getDuration(): number {
    if (this.startTime === 0) return 0
    return Date.now() - this.startTime
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    this.mediaRecorder = null
    this.startTime = 0
  }

  /**
   * 检查浏览器是否支持录音
   */
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)
  }
}
