type SpeechRecognitionAlternativeLike = {
  transcript?: string
  confidence?: number
}

type SpeechRecognitionResultLike = {
  isFinal?: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

type SpeechRecognitionEventLike = {
  resultIndex?: number
  results?: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionErrorEventLike = {
  error?: string
  message?: string
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type PreparedKeyword = {
  label: string
  normalizedCandidates: string[]
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
const DEFAULT_RESTART_DELAY_MS = 700
const MAX_RESTART_DELAY_MS = 10000
const NETWORK_ERROR_WINDOW_MS = 30000
const MAX_NETWORK_ERRORS_IN_WINDOW = 4
const NETWORK_ERROR_NOTIFY_INTERVAL_MS = 8000
const BUILTIN_PREFIX = 'builtin:'

function resolveSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null
  }

  const ctor =
    (window as any).SpeechRecognition ??
    (window as any).webkitSpeechRecognition

  return typeof ctor === 'function'
    ? (ctor as SpeechRecognitionConstructor)
    : null
}

export class WakeWordListener {
  private recognition: SpeechRecognitionLike | null = null
  private running = false
  private detectionCooldownMs = DEFAULT_DETECTION_COOLDOWN_MS
  private restartDelayMs = DEFAULT_RESTART_DELAY_MS
  private lastDetectionAt = 0
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private lifecycleToken = 0
  private preparedKeywords: PreparedKeyword[] = []
  private networkErrorWindowStartedAt = 0
  private networkErrorCount = 0
  private lastNetworkErrorNotifyAt = 0

  private onWakeWord: ((payload: WakeWordDetectedPayload) => void) | null = null
  private onStatusChange: ((status: WakeWordStatus) => void) | null = null
  private onError: ((message: string) => void) | null = null

  static isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    const hasSpeechRecognition = !!resolveSpeechRecognitionConstructor()
    const hasGetUserMedia =
      !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'

    return hasSpeechRecognition && hasGetUserMedia
  }

  start(options: WakeWordListenerOptions): void {
    this.startListening(options)
  }

  startListening(options: WakeWordListenerOptions): void {
    this.onWakeWord = options.onWakeWord
    this.onStatusChange = options.onStatusChange ?? null
    this.onError = options.onError ?? null
    this.detectionCooldownMs = options.detectionCooldownMs ?? DEFAULT_DETECTION_COOLDOWN_MS

    this.preparedKeywords = this.prepareKeywords(options.keywords)
    if (this.preparedKeywords.length === 0) {
      this.handleFatalStartError('唤醒词为空，已停止监听')
      return
    }

    this.running = true
    this.lastDetectionAt = 0
    this.restartDelayMs = DEFAULT_RESTART_DELAY_MS
    this.resetNetworkErrorTracking()
    this.clearRestartTimer()
    this.emitStatus('starting')

    const token = ++this.lifecycleToken
    void this.startInternal(token, options)
  }

  stop(): void {
    this.stopListening()
  }

  stopListening(): void {
    this.running = false
    this.lastDetectionAt = 0
    this.lifecycleToken += 1
    this.clearRestartTimer()
    this.teardownRecognition()
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
    if (!this.running || !this.isTokenActive(token)) {
      return
    }

    const RecognitionCtor = resolveSpeechRecognitionConstructor()
    if (!RecognitionCtor) {
      this.handleFatalStartError('当前环境不支持语音识别 API，无法启用语音唤醒')
      return
    }

    // 外部流程会提前请求麦克风权限并维护 stream，这里保留参数兼容即可。
    void options.audioStream

    const recognition = new RecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 3
    recognition.lang = this.resolveLanguage(options.language)

    recognition.onstart = () => {
      if (!this.running || !this.isTokenActive(token)) {
        return
      }
      this.emitStatus('listening')
    }

    recognition.onresult = (event) => {
      if (!this.running || !this.isTokenActive(token)) {
        return
      }
      this.handleRecognitionResult(event)
    }

    recognition.onerror = (event) => {
      if (!this.isTokenActive(token)) {
        return
      }
      this.handleRecognitionError(event)
    }

    recognition.onend = () => {
      if (!this.running || !this.isTokenActive(token)) {
        return
      }

      this.emitStatus('restarting')
      this.scheduleRestart(token)
    }

    this.recognition = recognition

    try {
      recognition.start()
    } catch (error) {
      this.handleFatalStartError(`语音识别启动失败: ${this.stringifyError(error)}`)
    }
  }

  private scheduleRestart(token: number): void {
    this.clearRestartTimer()
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null

      if (!this.running || !this.isTokenActive(token)) {
        return
      }

      const recognition = this.recognition
      if (!recognition) {
        this.handleFatalStartError('语音识别实例不可用，无法继续监听')
        return
      }

      try {
        recognition.start()
      } catch (error) {
        this.emitError(`语音识别重启失败: ${this.stringifyError(error)}`)
        this.scheduleRestart(token)
      }
    }, this.restartDelayMs)
  }

  private handleRecognitionResult(event: SpeechRecognitionEventLike): void {
    const results = event.results
    if (!results || results.length === 0) {
      return
    }

    const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0

    for (let index = startIndex; index < results.length; index += 1) {
      const result = results[index]
      if (!result || result.length === 0) {
        continue
      }

      const transcript = (result[0]?.transcript ?? '').trim()
      if (!transcript) {
        continue
      }

      const matchedKeyword = this.tryDetectKeyword(transcript)
      if (!matchedKeyword) {
        continue
      }

      const now = Date.now()
      if (now - this.lastDetectionAt < this.detectionCooldownMs) {
        continue
      }

      this.lastDetectionAt = now
      this.onWakeWord?.({
        keyword: matchedKeyword.label,
        transcript,
      })
      return
    }
  }

  private handleRecognitionError(event: SpeechRecognitionErrorEventLike): void {
    const errorCode = (event.error ?? '').trim().toLowerCase()

    if (errorCode === 'aborted' || errorCode === 'no-speech') {
      return
    }

    const message = this.formatRecognitionError(event)

    if (errorCode === 'network') {
      const networkState = this.registerNetworkError()
      if (networkState.shouldStop) {
        this.handleFatalStartError(
          '语音唤醒已暂停：语音识别服务不可用。请检查网络后手动重新开启，或改用全局快捷键录音。'
        )
        return
      }

      this.emitStatus('error')
      if (networkState.shouldNotify) {
        this.emitError(`${message}（${Math.round(networkState.retryDelayMs / 1000)} 秒后自动重试）`)
      }
      return
    }

    if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed' || errorCode === 'audio-capture') {
      this.handleFatalStartError(message)
      return
    }

    this.emitStatus('error')
    this.emitError(message)
  }

  private registerNetworkError(): {
    shouldStop: boolean
    shouldNotify: boolean
    retryDelayMs: number
  } {
    const now = Date.now()
    if (
      this.networkErrorWindowStartedAt === 0 ||
      now - this.networkErrorWindowStartedAt > NETWORK_ERROR_WINDOW_MS
    ) {
      this.networkErrorWindowStartedAt = now
      this.networkErrorCount = 0
    }

    this.networkErrorCount += 1
    const exponentialDelay = DEFAULT_RESTART_DELAY_MS * 2 ** Math.min(this.networkErrorCount - 1, 4)
    this.restartDelayMs = Math.min(MAX_RESTART_DELAY_MS, exponentialDelay)

    const shouldStop = this.networkErrorCount >= MAX_NETWORK_ERRORS_IN_WINDOW
    const shouldNotify =
      shouldStop ||
      this.networkErrorCount === 1 ||
      now - this.lastNetworkErrorNotifyAt >= NETWORK_ERROR_NOTIFY_INTERVAL_MS

    if (shouldNotify) {
      this.lastNetworkErrorNotifyAt = now
    }

    return {
      shouldStop,
      shouldNotify,
      retryDelayMs: this.restartDelayMs,
    }
  }

  private resetNetworkErrorTracking(): void {
    this.networkErrorWindowStartedAt = 0
    this.networkErrorCount = 0
    this.lastNetworkErrorNotifyAt = 0
  }

  private tryDetectKeyword(transcript: string): PreparedKeyword | null {
    const normalizedTranscript = this.normalizeText(transcript)
    if (!normalizedTranscript) {
      return null
    }

    const compactTranscript = normalizedTranscript.replace(/\s+/g, '')

    for (const keyword of this.preparedKeywords) {
      for (const candidate of keyword.normalizedCandidates) {
        if (!candidate) {
          continue
        }

        const compactCandidate = candidate.replace(/\s+/g, '')
        if (normalizedTranscript.includes(candidate) || compactTranscript.includes(compactCandidate)) {
          return keyword
        }
      }
    }

    return null
  }

  private prepareKeywords(rawKeywords: string[]): PreparedKeyword[] {
    const preparedKeywords: PreparedKeyword[] = []
    const dedupeSet = new Set<string>()

    for (const rawKeyword of rawKeywords) {
      if (typeof rawKeyword !== 'string') {
        continue
      }

      const original = rawKeyword.trim()
      if (!original) {
        continue
      }

      const displayLabel = this.extractKeywordLabel(original)
      if (!displayLabel) {
        continue
      }

      if (dedupeSet.has(displayLabel)) {
        continue
      }

      const normalizedCandidates = this.buildKeywordCandidates(original, displayLabel)
      if (normalizedCandidates.length === 0) {
        continue
      }

      dedupeSet.add(displayLabel)
      preparedKeywords.push({
        label: displayLabel,
        normalizedCandidates,
      })
    }

    return preparedKeywords
  }

  private extractKeywordLabel(keyword: string): string {
    let value = keyword.trim()
    if (value.toLowerCase().startsWith(BUILTIN_PREFIX)) {
      value = value.slice(BUILTIN_PREFIX.length).trim()
    }

    const withoutQuery = value.split(/[?#]/)[0] ?? value
    const baseName = withoutQuery.split(/[/\\]/).pop() ?? withoutQuery

    return baseName.replace(/\.ppn$/i, '').trim()
  }

  private buildKeywordCandidates(original: string, displayLabel: string): string[] {
    const candidates = new Set<string>()
    const addCandidate = (value: string) => {
      const normalized = this.normalizeText(value)
      if (!normalized) {
        return
      }

      candidates.add(normalized)
      const compact = normalized.replace(/\s+/g, '')
      if (compact) {
        candidates.add(compact)
      }
    }

    addCandidate(original)
    addCandidate(displayLabel)
    addCandidate(displayLabel.replace(/[_-]+/g, ' '))
    addCandidate(displayLabel.replace(/[_-\s]+/g, ''))

    if (original.toLowerCase().startsWith(BUILTIN_PREFIX)) {
      addCandidate(original.slice(BUILTIN_PREFIX.length))
    }

    return Array.from(candidates)
  }

  private resolveLanguage(language?: string): string {
    const preferredLanguage = language?.trim()
    if (preferredLanguage) {
      return preferredLanguage
    }

    const browserLanguage = typeof navigator !== 'undefined'
      ? (navigator.language ?? '').trim()
      : ''

    return browserLanguage || 'zh-CN'
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^0-9a-z\u4e00-\u9fff\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
  }

  private teardownRecognition(): void {
    const recognition = this.recognition
    this.recognition = null

    if (!recognition) {
      return
    }

    recognition.onstart = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null

    try {
      recognition.stop()
    } catch {
      // ignore stop failures when the recognizer is already stopped
    }

    try {
      recognition.abort?.()
    } catch {
      // ignore abort failures to keep shutdown path stable
    }
  }

  private handleFatalStartError(message: string): void {
    this.running = false
    this.lifecycleToken += 1
    this.clearRestartTimer()
    this.teardownRecognition()
    this.emitStatus('error')
    this.emitError(message)
  }

  private emitStatus(status: WakeWordStatus): void {
    this.onStatusChange?.(status)
  }

  private emitError(message: string): void {
    this.onError?.(message)
  }

  private isTokenActive(token: number): boolean {
    return this.running && token === this.lifecycleToken
  }

  private formatRecognitionError(event: SpeechRecognitionErrorEventLike): string {
    const errorCode = (event.error ?? '').trim().toLowerCase()
    const fallbackMessage = event.message?.trim() || '未知错误'

    switch (errorCode) {
      case 'not-allowed':
      case 'service-not-allowed':
        return '语音唤醒不可用：麦克风权限被拒绝'
      case 'audio-capture':
        return '语音唤醒不可用：未检测到可用麦克风'
      case 'network':
        return '语音唤醒识别网络异常，请检查网络连接'
      default:
        return `语音唤醒识别错误(${errorCode || 'unknown'}): ${fallbackMessage}`
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
}
