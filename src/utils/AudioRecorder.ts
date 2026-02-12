/**
 * 音频录制工具类
 * 使用 MediaRecorder API 录制音频
 */

export interface AudioRecorderOptions {
  sampleRate?: number // 采样率，默认 16000
  channelCount?: number // 声道数，默认 1（单声道）
  mimeType?: string // MIME 类型
  silenceDetection?: {
    enabled?: boolean // 是否启用静音检测
    threshold?: number // 音量阈值（RMS）
    durationMs?: number // 持续静音多久触发停止
    checkIntervalMs?: number // 检测间隔
    initialSilenceTimeoutMs?: number // 开始录音后无声音超时
  }
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null
  private startTime: number = 0
  private options: AudioRecorderOptions
  private silenceDetectedCallback: (() => void) | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private silenceCheckTimer: ReturnType<typeof setInterval> | null = null
  private lastSoundTimestamp: number = 0
  private hasDetectedVoice: boolean = false
  private silenceTriggered: boolean = false

  constructor(options: AudioRecorderOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate || 16000,
      channelCount: options.channelCount || 1,
      mimeType: options.mimeType || this.getSupportedMimeType(),
      silenceDetection: {
        enabled: options.silenceDetection?.enabled || false,
        threshold: options.silenceDetection?.threshold || 0.02,
        durationMs: options.silenceDetection?.durationMs || 1500,
        checkIntervalMs: options.silenceDetection?.checkIntervalMs || 120,
        initialSilenceTimeoutMs: options.silenceDetection?.initialSilenceTimeoutMs || 4000
      }
    }
  }

  /**
   * 设置静音检测回调
   */
  onSilenceDetected(callback: (() => void) | null): void {
    this.silenceDetectedCallback = callback
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
      this.lastSoundTimestamp = this.startTime
      this.hasDetectedVoice = false
      this.silenceTriggered = false

      // 监听数据
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onerror = (event) => {
        console.error('[AudioRecorder] 录音器错误:', event)
      }

      this.setupSilenceDetection()

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
    this.stopSilenceDetection()

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    this.mediaRecorder = null
    this.startTime = 0
    this.lastSoundTimestamp = 0
    this.hasDetectedVoice = false
    this.silenceTriggered = false
  }

  /**
   * 检查浏览器是否支持录音
   */
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && window.MediaRecorder)
  }

  /**
   * 启动静音检测
   */
  private setupSilenceDetection(): void {
    if (!this.stream || !this.options.silenceDetection?.enabled) {
      return
    }

    try {
      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.9
      source.connect(this.analyser)

      const data = new Uint8Array(this.analyser.fftSize)

      this.silenceCheckTimer = setInterval(() => {
        if (!this.analyser || this.silenceTriggered) {
          return
        }

        this.analyser.getByteTimeDomainData(data)
        const rms = this.calculateRms(data)
        const now = Date.now()

        if (rms >= (this.options.silenceDetection?.threshold || 0.02)) {
          this.lastSoundTimestamp = now
          this.hasDetectedVoice = true
          return
        }

        const silenceDuration = now - this.lastSoundTimestamp
        const requiredSilenceDuration = this.options.silenceDetection?.durationMs || 1500
        const initialSilenceTimeout = this.options.silenceDetection?.initialSilenceTimeoutMs || 4000
        const initialTimeoutReached = !this.hasDetectedVoice && now - this.startTime >= initialSilenceTimeout

        if (silenceDuration >= requiredSilenceDuration && (this.hasDetectedVoice || initialTimeoutReached)) {
          this.silenceTriggered = true
          this.stopSilenceDetection()
          this.silenceDetectedCallback?.()
        }
      }, this.options.silenceDetection?.checkIntervalMs || 120)
    } catch (error) {
      console.warn('[AudioRecorder] 静音检测启动失败，继续录音:', error)
      this.stopSilenceDetection()
    }
  }

  /**
   * 停止静音检测
   */
  private stopSilenceDetection(): void {
    if (this.silenceCheckTimer) {
      clearInterval(this.silenceCheckTimer)
      this.silenceCheckTimer = null
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // ignore
      })
      this.audioContext = null
    }

    this.analyser = null
  }

  /**
   * 计算音量 RMS
   */
  private calculateRms(data: Uint8Array): number {
    let sumSquares = 0

    for (let index = 0; index < data.length; index += 1) {
      const normalizedValue = (data[index] - 128) / 128
      sumSquares += normalizedValue * normalizedValue
    }

    return Math.sqrt(sumSquares / data.length)
  }
}
