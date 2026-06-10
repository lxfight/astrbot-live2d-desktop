/**
 * 音频口型同步分析器
 *
 * 通过 Web Audio AnalyserNode 实时分析 <audio> 元素的播放音量（RMS），
 * 映射为 0~1 的口型开合值，供 Live2D 模型驱动 LipSync 参数（ParamMouthOpenY）。
 */

export interface LipSyncAnalyzerOptions {
  /** RMS 增益系数，语音 RMS 通常在 0.05~0.3，放大后接近 0~1 */
  gain?: number
  /** 噪声门限，低于该 RMS 视为静音 */
  noiseGate?: number
  /** 张嘴平滑系数（越大响应越快） */
  attack?: number
  /** 闭嘴平滑系数（越小闭合越缓） */
  release?: number
}

const DEFAULT_OPTIONS: Required<LipSyncAnalyzerOptions> = {
  gain: 3.2,
  noiseGate: 0.01,
  attack: 0.55,
  release: 0.25
}

// 同一个 HTMLMediaElement 只能创建一次 MediaElementSourceNode，
// 且创建后音频输出会被重定向到 audio graph，必须缓存复用并保持 destination 连接
const mediaSourceCache = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()

let sharedAudioContext: AudioContext | null = null

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext()
  }
  return sharedAudioContext
}

function getMediaElementSource(
  context: AudioContext,
  element: HTMLAudioElement
): MediaElementAudioSourceNode {
  let source = mediaSourceCache.get(element)
  if (!source) {
    source = context.createMediaElementSource(element)
    source.connect(context.destination)
    mediaSourceCache.set(element, source)
  }
  return source
}

export class AudioLipSyncAnalyzer {
  private options: Required<LipSyncAnalyzerOptions>
  private analyser: AnalyserNode | null = null
  private connectedSource: MediaElementAudioSourceNode | null = null
  private sampleBuffer: Float32Array<ArrayBuffer> | null = null
  private frameId: number | null = null
  private smoothedValue = 0
  private onValueCallback: ((value: number) => void) | null = null

  constructor(options: LipSyncAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  get isRunning(): boolean {
    return this.frameId !== null
  }

  /**
   * 开始分析指定音频元素，onValue 以 rAF 频率回调 0~1 的口型值
   */
  start(audioElement: HTMLAudioElement, onValue: (value: number) => void): boolean {
    this.stop()

    let context: AudioContext
    let source: MediaElementAudioSourceNode
    try {
      context = getSharedAudioContext()
      source = getMediaElementSource(context, audioElement)
    } catch (error) {
      console.warn('[口型同步] 音频分析初始化失败:', error)
      return false
    }

    if (context.state === 'suspended') {
      void context.resume().catch(() => {})
    }

    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)

    this.analyser = analyser
    this.connectedSource = source
    this.sampleBuffer = new Float32Array(analyser.fftSize)
    this.smoothedValue = 0
    this.onValueCallback = onValue

    const tick = () => {
      this.frameId = requestAnimationFrame(tick)
      this.onValueCallback?.(this.computeValue())
    }
    this.frameId = requestAnimationFrame(tick)
    return true
  }

  /**
   * 停止分析并把口型值归零
   */
  stop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }

    if (this.connectedSource && this.analyser) {
      try {
        this.connectedSource.disconnect(this.analyser)
      } catch {
        // 节点可能已被断开
      }
    }
    this.connectedSource = null
    this.analyser = null
    this.sampleBuffer = null
    this.smoothedValue = 0
    this.onValueCallback?.(0)
    this.onValueCallback = null
  }

  private computeValue(): number {
    const analyser = this.analyser
    const buffer = this.sampleBuffer
    if (!analyser || !buffer) {
      return 0
    }

    analyser.getFloatTimeDomainData(buffer)

    let sumSquares = 0
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i]
    }
    const rms = Math.sqrt(sumSquares / buffer.length)

    const { gain, noiseGate, attack, release } = this.options
    const target = rms < noiseGate ? 0 : Math.min(1, rms * gain)

    const factor = target > this.smoothedValue ? attack : release
    this.smoothedValue += (target - this.smoothedValue) * factor
    if (this.smoothedValue < 0.001) {
      this.smoothedValue = 0
    }

    return this.smoothedValue
  }
}
