type PorcupineProcessResult =
  | number
  | boolean
  | {
      label?: string
      keywordLabel?: string
      keyword?: string
      keywordIndex?: number
      isDetected?: boolean
    }
  | null
  | undefined

type PorcupineCreateKeywordConfig = {
  publicPath?: string
  builtin?: unknown
  label?: string
  sensitivity?: number
}

type PorcupineInstance = {
  process: (pcm: Int16Array) => PorcupineProcessResult | Promise<PorcupineProcessResult>
  release?: () => void | Promise<void>
  frameLength?: number
  sampleRate?: number
}

type PorcupineCreateOptions = {
  accessKey: string
  keyword: PorcupineCreateKeywordConfig | PorcupineCreateKeywordConfig[]
  model?: { publicPath: string }
  processErrorCallback?: (error: unknown) => void
}

type PorcupineCreateFunction = (options: PorcupineCreateOptions) => Promise<PorcupineInstance>

type PorcupineModuleLike = {
  Porcupine?: { create?: PorcupineCreateFunction }
  PorcupineWorker?: { create?: PorcupineCreateFunction }
  default?: {
    Porcupine?: { create?: PorcupineCreateFunction }
    PorcupineWorker?: { create?: PorcupineCreateFunction }
  }
  BuiltInKeyword?: Record<string, unknown>
}

type PreparedKeyword =
  | {
      mode: 'custom'
      original: string
      normalized: string
      label: string
      publicPath: string
    }
  | {
      mode: 'builtin'
      original: string
      normalized: string
      label: string
      builtinName: string
    }

export type WakeWordStatus = 'idle' | 'starting' | 'listening' | 'restarting' | 'stopped' | 'error'

export interface WakeWordDetectedPayload {
  keyword: string
  transcript: string
}

export interface WakeWordListenerOptions {
  keywords: string[]
  language?: string
  detectionCooldownMs?: number
  onWakeWord: (payload: WakeWordDetectedPayload) => void
  onStatusChange?: (status: WakeWordStatus) => void
  onError?: (message: string) => void
  audioStream?: MediaStream | null
  accessKey?: string
  modelPath?: string
  keywordBasePath?: string
}

const DEFAULT_DETECTION_COOLDOWN_MS = 1500
const DEFAULT_MODEL_PUBLIC_PATH = './wakeword/porcupine_params.pv'
const DEFAULT_KEYWORD_BASE_PATH = './wakeword/keywords'
const DEFAULT_PORCUPINE_MODULE_PATH = './wakeword/porcupine/porcupine.js'
const DEFAULT_FRAME_LENGTH = 512
const DEFAULT_SAMPLE_RATE = 16000
const DEFAULT_SENSITIVITY = 0.65
const SCRIPT_PROCESSOR_BUFFER_SIZE = 2048

export class WakeWordListener {
  private porcupine: PorcupineInstance | null = null
  private running = false
  private detectionCooldownMs = DEFAULT_DETECTION_COOLDOWN_MS
  private lastDetectionAt = 0
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private lifecycleToken = 0
  private startOptions: WakeWordListenerOptions | null = null
  private preparedKeywords: PreparedKeyword[] = []
  private keywordLabelLookup = new Map<string, string>()

  private onWakeWord: ((payload: WakeWordDetectedPayload) => void) | null = null
  private onStatusChange: ((status: WakeWordStatus) => void) | null = null
  private onError: ((message: string) => void) | null = null

  private audioStream: MediaStream | null = null
  private ownsAudioStream = false
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private muteGainNode: GainNode | null = null
  private queuedSamples = new Int16Array(0)
  private resampleRemainder = new Float32Array(0)
  private processingFrames = false
  private frameLength = DEFAULT_FRAME_LENGTH
  private targetSampleRate = DEFAULT_SAMPLE_RATE

  static isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    const hasAudioContext =
      typeof window.AudioContext === 'function' || typeof (window as any).webkitAudioContext === 'function'
    const hasGetUserMedia =
      !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'

    return hasAudioContext && hasGetUserMedia
  }

  start(options: WakeWordListenerOptions): void {
    this.startListening(options)
  }

  startListening(options: WakeWordListenerOptions): void {
    this.onWakeWord = options.onWakeWord
    this.onStatusChange = options.onStatusChange ?? null
    this.onError = options.onError ?? null
    this.detectionCooldownMs = options.detectionCooldownMs ?? DEFAULT_DETECTION_COOLDOWN_MS

    const keywordBasePath = this.resolveKeywordBasePath(options)
    this.preparedKeywords = this.prepareKeywords(options.keywords, keywordBasePath)
    if (this.preparedKeywords.length === 0) {
      this.handleFatalStartError('唤醒词为空，已停止监听')
      return
    }

    this.running = true
    this.startOptions = { ...options }
    this.emitStatus('starting')

    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }

    const token = ++this.lifecycleToken
    void this.startInternal(token, options)
  }

  stop(): void {
    this.stopListening()
  }

  stopListening(): void {
    this.running = false
    this.startOptions = null
    this.lifecycleToken += 1
    this.lastDetectionAt = 0

    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }

    void this.teardownRuntime()
    this.emitStatus('stopped')
  }

  destroy(): void {
    this.stopListening()
    this.onWakeWord = null
    this.onStatusChange = null
    this.onError = null
    this.emitStatus('idle')
  }

  private async startInternal(token: number, options: WakeWordListenerOptions): Promise<void> {
    await this.teardownRuntime()
    if (!this.isTokenActive(token)) {
      return
    }

    const accessKey = this.resolveAccessKey(options)
    if (!accessKey) {
      this.handleFatalStartError('缺少 Porcupine AccessKey，请在配置中设置 VITE_PORCUPINE_ACCESS_KEY')
      return
    }

    const modelPath = this.resolveModelPath(options)
    const missingAssets = await this.findMissingAssets([
      modelPath,
      ...this.preparedKeywords
        .filter((keyword) => keyword.mode === 'custom')
        .map((keyword) => keyword.publicPath),
    ])
    if (!this.isTokenActive(token)) {
      return
    }
    if (missingAssets.length > 0) {
      const fileList = missingAssets.join(', ')
      this.handleFatalStartError(`唤醒词资源缺失: ${fileList}`)
      return
    }

    let moduleLike: PorcupineModuleLike
    try {
      moduleLike = await this.loadPorcupineModule()
    } catch (error) {
      this.handleFatalStartError(this.stringifyError(error))
      return
    }
    if (!this.isTokenActive(token)) {
      return
    }

    let createFunction: PorcupineCreateFunction | null = null
    try {
      createFunction = this.resolveCreateFunction(moduleLike)
    } catch (error) {
      this.handleFatalStartError(this.stringifyError(error))
      return
    }
    if (!createFunction) {
      this.handleFatalStartError('未找到 Porcupine.create 接口，请检查本地 Porcupine SDK 文件')
      return
    }

    const builtInKeywords = moduleLike.BuiltInKeyword ?? null
    let keywordConfigs: PorcupineCreateKeywordConfig[]
    try {
      keywordConfigs = this.preparedKeywords.map((keyword) =>
        this.toKeywordConfig(keyword, builtInKeywords)
      )
    } catch (error) {
      this.handleFatalStartError(this.stringifyError(error))
      return
    }

    try {
      this.porcupine = await createFunction({
        accessKey,
        keyword: keywordConfigs,
        model: { publicPath: modelPath },
        processErrorCallback: (error) => {
          this.handleRuntimeError(`Porcupine 运行错误: ${this.stringifyError(error)}`)
        },
      })
    } catch (error) {
      this.handleFatalStartError(`Porcupine 初始化失败: ${this.stringifyError(error)}`)
      return
    }

    if (!this.isTokenActive(token)) {
      await this.releasePorcupine()
      return
    }

    if (!this.porcupine || typeof this.porcupine.process !== 'function') {
      this.handleFatalStartError('Porcupine 实例不可用，缺少 process() 方法')
      return
    }

    this.frameLength = this.resolvePositiveNumber(this.porcupine.frameLength, DEFAULT_FRAME_LENGTH)
    this.targetSampleRate = this.resolvePositiveNumber(this.porcupine.sampleRate, DEFAULT_SAMPLE_RATE)

    try {
      await this.startAudioPipeline(options.audioStream ?? null)
    } catch (error) {
      this.handleRuntimeError(`唤醒监听音频管线启动失败: ${this.stringifyError(error)}`)
      return
    }

    if (!this.isTokenActive(token)) {
      await this.teardownRuntime()
      return
    }

    this.emitStatus('listening')
  }

  private resolveAccessKey(options: WakeWordListenerOptions): string {
    const envValue = (import.meta.env?.VITE_PORCUPINE_ACCESS_KEY as string | undefined) ?? ''
    return (options.accessKey || envValue).trim()
  }

  private resolveModelPath(options: WakeWordListenerOptions): string {
    const envValue = (import.meta.env?.VITE_PORCUPINE_MODEL_PATH as string | undefined) ?? ''
    return (options.modelPath || envValue || DEFAULT_MODEL_PUBLIC_PATH).trim()
  }

  private resolveKeywordBasePath(options: WakeWordListenerOptions): string {
    const envValue = (import.meta.env?.VITE_PORCUPINE_KEYWORD_BASE_PATH as string | undefined) ?? ''
    return (options.keywordBasePath || envValue || DEFAULT_KEYWORD_BASE_PATH).trim()
  }

  private resolvePorcupineModulePath(): string {
    const envValue = (import.meta.env?.VITE_PORCUPINE_MODULE_PATH as string | undefined) ?? ''
    return (envValue || DEFAULT_PORCUPINE_MODULE_PATH).trim()
  }

  private prepareKeywords(rawKeywords: string[], keywordBasePath: string): PreparedKeyword[] {
    this.keywordLabelLookup.clear()

    const prepared: PreparedKeyword[] = []
    const dedupeSet = new Set<string>()
    for (const rawKeyword of rawKeywords) {
      const trimmed = rawKeyword.trim()
      if (!trimmed) {
        continue
      }

      const normalized = this.normalizeText(trimmed)
      if (!normalized || dedupeSet.has(normalized)) {
        continue
      }
      dedupeSet.add(normalized)

      const builtinPrefix = 'builtin:'
      if (trimmed.toLowerCase().startsWith(builtinPrefix)) {
        const builtinName = trimmed.slice(builtinPrefix.length).trim()
        if (!builtinName) {
          continue
        }

        prepared.push({
          mode: 'builtin',
          original: trimmed,
          normalized,
          label: trimmed,
          builtinName,
        })
        this.keywordLabelLookup.set(normalized, trimmed)
        continue
      }

      const publicPath = this.resolveKeywordPublicPath(trimmed, keywordBasePath)
      prepared.push({
        mode: 'custom',
        original: trimmed,
        normalized,
        label: trimmed,
        publicPath,
      })

      this.keywordLabelLookup.set(normalized, trimmed)
      const fileStem = this.normalizeText(trimmed.replace(/\.ppn$/i, ''))
      if (fileStem && !this.keywordLabelLookup.has(fileStem)) {
        this.keywordLabelLookup.set(fileStem, trimmed)
      }
    }

    return prepared
  }

  private resolveKeywordPublicPath(keyword: string, keywordBasePath: string): string {
    const hasExplicitPath =
      keyword.startsWith('/') ||
      keyword.startsWith('./') ||
      keyword.startsWith('../') ||
      /^https?:\/\//i.test(keyword)

    if (hasExplicitPath) {
      return keyword
    }

    const sanitizedBase = keywordBasePath.endsWith('/')
      ? keywordBasePath.slice(0, -1)
      : keywordBasePath

    if (/\.ppn$/i.test(keyword)) {
      return `${sanitizedBase}/${keyword.replace(/^\/+/, '')}`
    }

    return `${sanitizedBase}/${encodeURIComponent(keyword)}.ppn`
  }

  private async loadPorcupineModule(): Promise<PorcupineModuleLike> {
    const modulePath = this.resolvePorcupineModulePath()
    try {
      const moduleLike = (await import(/* @vite-ignore */ modulePath)) as PorcupineModuleLike
      return moduleLike
    } catch (error) {
      const message = this.stringifyError(error)
      throw new Error(
        `无法加载本地 Porcupine 模块 (${modulePath})。请确认文件存在且可离线访问。原始错误: ${message}`
      )
    }
  }

  private resolveCreateFunction(moduleLike: PorcupineModuleLike): PorcupineCreateFunction {
    const candidates: Array<PorcupineCreateFunction | undefined> = [
      moduleLike.PorcupineWorker?.create,
      moduleLike.Porcupine?.create,
      moduleLike.default?.PorcupineWorker?.create,
      moduleLike.default?.Porcupine?.create,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'function') {
        return candidate
      }
    }

    throw new Error('本地 Porcupine 模块缺少 create() 接口')
  }

  private toKeywordConfig(
    keyword: PreparedKeyword,
    builtInKeywords: Record<string, unknown> | null
  ): PorcupineCreateKeywordConfig {
    if (keyword.mode === 'custom') {
      return {
        publicPath: keyword.publicPath,
        label: keyword.label,
        sensitivity: DEFAULT_SENSITIVITY,
      }
    }

    if (!builtInKeywords) {
      throw new Error('当前 Porcupine 模块不支持内置关键词，请改为本地 .ppn 文件')
    }

    const builtInValue = this.resolveBuiltInKeyword(keyword.builtinName, builtInKeywords)
    if (builtInValue === null) {
      throw new Error(`未找到内置唤醒词: ${keyword.builtinName}`)
    }

    return {
      builtin: builtInValue,
      label: keyword.label,
      sensitivity: DEFAULT_SENSITIVITY,
    }
  }

  private resolveBuiltInKeyword(
    keywordName: string,
    builtInKeywords: Record<string, unknown>
  ): unknown | null {
    const target = keywordName.trim().toLowerCase()
    for (const [name, value] of Object.entries(builtInKeywords)) {
      if (name.toLowerCase() === target) {
        return value
      }
    }
    return null
  }

  private async findMissingAssets(paths: string[]): Promise<string[]> {
    const missing: string[] = []
    const uniquePaths = Array.from(new Set(paths.filter(Boolean)))

    for (const assetPath of uniquePaths) {
      const exists = await this.assetExists(assetPath)
      if (!exists) {
        missing.push(assetPath)
      }
    }

    return missing
  }

  private async assetExists(path: string): Promise<boolean> {
    try {
      const headResponse = await fetch(path, { method: 'HEAD', cache: 'no-store' })
      if (headResponse.ok) {
        return true
      }

      if (headResponse.status !== 405) {
        return false
      }
    } catch {
      // ignore and fallback to GET
    }

    try {
      const getResponse = await fetch(path, { method: 'GET', cache: 'no-store' })
      return getResponse.ok
    } catch {
      return false
    }
  }

  private async startAudioPipeline(inputStream: MediaStream | null): Promise<void> {
    this.audioStream = inputStream
    this.ownsAudioStream = false

    if (!this.audioStream) {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.targetSampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      this.ownsAudioStream = true
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) {
      throw new Error('当前环境不支持 AudioContext')
    }

    this.audioContext = new AudioContextCtor()
    this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream)
    this.processorNode = this.audioContext.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, 1, 1)
    this.muteGainNode = this.audioContext.createGain()
    this.muteGainNode.gain.value = 0

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      this.handleAudioProcess(event)
    }

    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.muteGainNode)
    this.muteGainNode.connect(this.audioContext.destination)

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  private handleAudioProcess(event: AudioProcessingEvent): void {
    if (!this.running || !this.porcupine) {
      return
    }

    const channelData = event.inputBuffer.getChannelData(0)
    if (!channelData || channelData.length === 0) {
      return
    }

    const pcm = this.toInt16Mono(channelData, event.inputBuffer.sampleRate, this.targetSampleRate)
    if (pcm.length === 0) {
      return
    }

    this.enqueueSamples(pcm)
  }

  private toInt16Mono(
    input: Float32Array,
    inputSampleRate: number,
    targetSampleRate: number
  ): Int16Array {
    const merged = new Float32Array(this.resampleRemainder.length + input.length)
    merged.set(this.resampleRemainder, 0)
    merged.set(input, this.resampleRemainder.length)

    if (inputSampleRate <= 0 || targetSampleRate <= 0) {
      this.resampleRemainder = new Float32Array(0)
      return this.floatToInt16(merged)
    }

    if (inputSampleRate === targetSampleRate) {
      this.resampleRemainder = new Float32Array(0)
      return this.floatToInt16(merged)
    }

    const sampleRateRatio = inputSampleRate / targetSampleRate
    const outputLength = Math.floor(merged.length / sampleRateRatio)
    if (outputLength <= 0) {
      this.resampleRemainder = merged
      return new Int16Array(0)
    }

    const output = new Int16Array(outputLength)
    let sourceOffset = 0
    for (let i = 0; i < outputLength; i += 1) {
      const nextSourceOffset = Math.min(
        merged.length,
        Math.round((i + 1) * sampleRateRatio)
      )

      let sum = 0
      let count = 0
      for (let offset = sourceOffset; offset < nextSourceOffset; offset += 1) {
        sum += merged[offset]
        count += 1
      }

      const average = count > 0 ? sum / count : merged[sourceOffset] || 0
      const clamped = Math.max(-1, Math.min(1, average))
      output[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767)

      sourceOffset = nextSourceOffset
    }

    this.resampleRemainder = merged.slice(sourceOffset)
    return output
  }

  private floatToInt16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, input[i]))
      output[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767)
    }
    return output
  }

  private enqueueSamples(samples: Int16Array): void {
    const merged = new Int16Array(this.queuedSamples.length + samples.length)
    merged.set(this.queuedSamples, 0)
    merged.set(samples, this.queuedSamples.length)
    this.queuedSamples = merged

    if (!this.processingFrames) {
      this.processingFrames = true
      void this.processQueuedFrames()
    }
  }

  private async processQueuedFrames(): Promise<void> {
    try {
      while (this.running && this.porcupine && this.queuedSamples.length >= this.frameLength) {
        const frame = this.queuedSamples.slice(0, this.frameLength)
        this.queuedSamples = this.queuedSamples.slice(this.frameLength)

        const result = await this.porcupine.process(frame)
        const detectedKeyword = this.resolveDetectedKeyword(result)
        if (!detectedKeyword) {
          continue
        }

        const now = Date.now()
        if (now - this.lastDetectionAt < this.detectionCooldownMs) {
          continue
        }
        this.lastDetectionAt = now

        this.onWakeWord?.({
          keyword: detectedKeyword,
          transcript: detectedKeyword,
        })
      }
    } catch (error) {
      this.handleRuntimeError(`唤醒词识别处理失败: ${this.stringifyError(error)}`)
    } finally {
      this.processingFrames = false
      if (this.running && this.queuedSamples.length >= this.frameLength && !this.processingFrames) {
        this.processingFrames = true
        void this.processQueuedFrames()
      }
    }
  }

  private resolveDetectedKeyword(result: PorcupineProcessResult): string | null {
    if (typeof result === 'boolean') {
      return result ? this.preparedKeywords[0]?.original ?? null : null
    }

    if (typeof result === 'number') {
      if (result < 0) {
        return null
      }
      return this.preparedKeywords[result]?.original ?? this.preparedKeywords[0]?.original ?? null
    }

    if (!result || typeof result !== 'object') {
      return null
    }

    const detectionLabel = result.keywordLabel || result.label || result.keyword || ''
    if (typeof detectionLabel === 'string' && detectionLabel.trim()) {
      const byLabel = this.findKeywordByLabel(detectionLabel)
      if (byLabel) {
        return byLabel
      }
    }

    if (typeof result.keywordIndex === 'number' && result.keywordIndex >= 0) {
      return this.preparedKeywords[result.keywordIndex]?.original ?? null
    }

    if (result.isDetected) {
      return this.preparedKeywords[0]?.original ?? null
    }

    return null
  }

  private findKeywordByLabel(label: string): string | null {
    const normalized = this.normalizeText(label)
    if (!normalized) {
      return null
    }

    const fromMap = this.keywordLabelLookup.get(normalized)
    if (fromMap) {
      return fromMap
    }

    return null
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
  }

  private handleRuntimeError(message: string): void {
    if (!this.running || !this.startOptions) {
      this.emitStatus('error')
      this.emitError(message)
      return
    }

    this.emitStatus('error')
    this.emitError(message)
    void this.teardownRuntime()
    this.scheduleRestart()
  }

  private handleFatalStartError(message: string): void {
    this.running = false
    this.startOptions = null
    this.emitStatus('error')
    this.emitError(message)
    void this.teardownRuntime()
  }

  private scheduleRestart(): void {
    if (!this.running || !this.startOptions) {
      return
    }

    if (this.restartTimer) {
      return
    }

    this.emitStatus('restarting')
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (!this.running || !this.startOptions) {
        return
      }

      const token = ++this.lifecycleToken
      void this.startInternal(token, this.startOptions)
    }, 1000)
  }

  private async teardownRuntime(): Promise<void> {
    if (this.processorNode) {
      this.processorNode.onaudioprocess = null
      try {
        this.processorNode.disconnect()
      } catch {
        // ignore
      }
      this.processorNode = null
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch {
        // ignore
      }
      this.sourceNode = null
    }

    if (this.muteGainNode) {
      try {
        this.muteGainNode.disconnect()
      } catch {
        // ignore
      }
      this.muteGainNode = null
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close()
      } catch {
        // ignore
      }
      this.audioContext = null
    }

    this.queuedSamples = new Int16Array(0)
    this.resampleRemainder = new Float32Array(0)
    this.processingFrames = false

    if (this.audioStream && this.ownsAudioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop())
    }
    this.audioStream = null
    this.ownsAudioStream = false

    await this.releasePorcupine()
  }

  private async releasePorcupine(): Promise<void> {
    if (!this.porcupine) {
      return
    }

    try {
      await this.porcupine.release?.()
    } catch {
      // ignore
    }
    this.porcupine = null
  }

  private isTokenActive(token: number): boolean {
    return this.running && token === this.lifecycleToken
  }

  private resolvePositiveNumber(value: unknown, fallback: number): number {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.round(numeric)
    }
    return fallback
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    return String(error)
  }

  private emitStatus(status: WakeWordStatus): void {
    this.onStatusChange?.(status)
  }

  private emitError(message: string): void {
    this.onError?.(message)
  }
}
