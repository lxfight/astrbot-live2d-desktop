/**
 * LipSyncAnalyzer - 通过 Web Audio API 实时分析音频音量，驱动 Live2D 嘴型参数
 *
 * 工作流程：
 * AudioContext → createMediaElementSource → AnalyserNode → destination
 * 每帧读取 getByteFrequencyData → 计算 RMS 音量 → 映射到 0.0~1.0
 *
 * 注意：createMediaElementSource 对同一个 audio 元素只能调用一次，
 * 因此 AudioContext 和 sourceNode 会持久化，stop 只断开 destination。
 */
export class LipSyncAnalyzer {
  private audioContext: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private connectedElement: HTMLAudioElement | null = null
  private frequencyData: Uint8Array<ArrayBuffer> | null = null

  /** 当前归一化音量 0.0 ~ 1.0 */
  private _currentValue: number = 0.0

  /** audio 元素是否已经被 createMediaElementSource 接管过 */
  private elementCaptured: boolean = false

  /** 音量平滑系数（0~1，越小越平滑） */
  private readonly smoothing: number

  /** 静音阈值，低于此值直接归零 */
  private readonly silenceThreshold: number

  // 默认灵敏度参数
  private static readonly DEFAULT_SMOOTHING = 0.3
  private static readonly DEFAULT_SILENCE_THRESHOLD = 0.02

  constructor(options?: { smoothing?: number; silenceThreshold?: number }) {
    this.smoothing = options?.smoothing ?? LipSyncAnalyzer.DEFAULT_SMOOTHING
    this.silenceThreshold = options?.silenceThreshold ?? LipSyncAnalyzer.DEFAULT_SILENCE_THRESHOLD
  }

  /**
   * 开始分析音频元素
   *
   * 如果是同一个 audio 元素，复用已有的 AudioContext 和 sourceNode，
   * 只需要重新连接 destination 即可。
   */
  start(audioElement: HTMLAudioElement): void {
    console.log('[LipSync] start() 被调用, audioElement=%o, currentConnected=%o, captured=%s',
      audioElement, this.connectedElement, this.elementCaptured)

    // 已经是活跃状态且连着同一个元素 → 确保 destination 连通即可
    if (this.connectedElement === audioElement && this.analyser) {
      console.log('[LipSync] 已经连接到同一个元素，确保 destination 连通')
      this.ensureDestinationConnected()
      return
    }

    // 换了不同的 audio 元素 → 先清理旧的
    if (this.connectedElement && this.connectedElement !== audioElement) {
      console.log('[LipSync] 切换 audio 元素: 旧=%o → 新=%o', this.connectedElement, audioElement)
      this.fullCleanup()
    }

    try {
      // 首次连接这个 audio 元素
      if (!this.elementCaptured) {
        console.log('[LipSync] 首次连接，创建 AudioContext + MediaElementSource')
        const ctx = new AudioContext()
        this.audioContext = ctx

        const source = ctx.createMediaElementSource(audioElement)
        this.sourceNode = source

        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.6
        this.analyser = analyser

        source.connect(analyser)
        this.frequencyData = new Uint8Array(analyser.frequencyBinCount)
        this.connectedElement = audioElement
        this.elementCaptured = true

        console.log('[LipSync] AudioContext 创建成功, state=%s, fftSize=%d',
          ctx.state, analyser.fftSize)
      } else {
        console.log('[LipSync] audio 元素已被接管，复用已有节点')
      }

      // 确保 AudioContext 没有被挂起（浏览器自动播放策略）
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('[LipSync] AudioContext 处于 suspended 状态，尝试 resume...')
        this.audioContext.resume().then(() => {
          console.log('[LipSync] AudioContext resume 成功, state=%s', this.audioContext?.state)
        }).catch((err) => {
          console.error('[LipSync] AudioContext resume 失败:', err)
        })
      }

      // 连接到 destination — 这一步让声音能出来
      this.ensureDestinationConnected()
    } catch (error) {
      console.error('[LipSync] 启动分析器失败:', error)
      // 如果 createMediaElementSource 失败了，整个音频链路就断了
      // 需要重置状态
      this.fullCleanup()
    }
  }

  /**
   * 暂停分析（断开 destination），但保留 AudioContext 和 sourceNode
   * 这样下次 start 同一个元素时不需要重新 createMediaElementSource
   */
  stop(): void {
    console.log('[LipSync] stop() 被调用')
    this._currentValue = 0.0

    // 只断开 analyser → destination，保留 source → analyser
    if (this.analyser) {
      try {
        this.analyser.disconnect()
        console.log('[LipSync] analyser 已从 destination 断开')
      } catch { /* ignore */ }
    }

    console.log('[LipSync] 分析器已暂停（AudioContext 保留）')
  }

  /**
   * 确保 analyser → destination 连通
   * stop() 会断开这个连接，每次 start() 都需要重新连上
   */
  private ensureDestinationConnected(): void {
    if (!this.analyser || !this.audioContext) return
    try {
      this.analyser.connect(this.audioContext.destination)
      console.log('[LipSync] analyser → destination 已连接')
    } catch (e) {
      // 可能已经连接了，忽略
      console.warn('[LipSync] analyser → destination 连接失败:', e)
    }
  }

  /**
   * 完全清理所有资源（换元素时使用）
   */
  private fullCleanup(): void {
    try {
      this.analyser?.disconnect()
    } catch { /* ignore */ }
    try {
      this.sourceNode?.disconnect()
    } catch { /* ignore */ }

    this.analyser = null
    this.sourceNode = null
    this.frequencyData = null
    this.connectedElement = null
    this.elementCaptured = false

    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }

    console.log('[LipSync] 完全清理完成')
  }

  /**
   * 销毁分析器（组件卸载时调用）
   */
  destroy(): void {
    console.log('[LipSync] destroy() 被调用')
    this._currentValue = 0.0
    this.fullCleanup()
  }

  /**
   * 每帧调用，更新音量值
   * @returns 归一化音量 0.0 ~ 1.0
   */
  update(): number {
    if (!this.analyser || !this.frequencyData) {
      this._currentValue = 0.0
      return 0.0
    }

    this.analyser.getByteFrequencyData(this.frequencyData)

    // 计算 RMS（均方根）音量
    let sum = 0
    for (let i = 0; i < this.frequencyData.length; i++) {
      const normalized = this.frequencyData[i] / 255.0
      sum += normalized * normalized
    }
    const rms = Math.sqrt(sum / this.frequencyData.length)

    // 静音检测
    if (rms < this.silenceThreshold) {
      this._currentValue = 0.0
      return 0.0
    }

    // 映射到 0~1 并平滑
    const mapped = Math.min(rms * 2.5, 1.0) // 放大灵敏度
    this._currentValue = this._currentValue * this.smoothing + mapped * (1.0 - this.smoothing)

    return this._currentValue
  }

  /**
   * 获取当前音量值（不触发更新）
   */
  get currentValue(): number {
    return this._currentValue
  }
}
