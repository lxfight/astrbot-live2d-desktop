type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  processLocally?: boolean
  onstart: ((event: Event) => void) | null
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: ((event: Event) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

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
}

export class WakeWordListener {
  private recognition: SpeechRecognitionInstance | null = null
  private keywords: Array<{ original: string; normalized: string }> = []
  private running = false
  private manualStopping = false
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private lastDetectionAt = 0
  private detectionCooldownMs = 1500
  private language = 'zh-CN'
  private onWakeWord: ((payload: WakeWordDetectedPayload) => void) | null = null
  private onStatusChange: ((status: WakeWordStatus) => void) | null = null
  private onError: ((message: string) => void) | null = null

  static isSupported(): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }

    return typeof win.SpeechRecognition === 'function' || typeof win.webkitSpeechRecognition === 'function'
  }

  start(options: WakeWordListenerOptions): void {
    this.onWakeWord = options.onWakeWord
    this.onStatusChange = options.onStatusChange ?? null
    this.onError = options.onError ?? null
    this.language = options.language || 'zh-CN'
    this.detectionCooldownMs = options.detectionCooldownMs ?? 1500
    this.keywords = this.prepareKeywords(options.keywords)

    if (this.keywords.length === 0) {
      this.stop()
      this.emitError('唤醒词为空，已停止监听')
      return
    }

    this.ensureRecognition()
    if (!this.recognition) {
      this.emitStatus('error')
      this.emitError('当前环境不支持语音识别')
      return
    }

    this.running = true
    this.manualStopping = false
    this.recognition.lang = this.language
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.maxAlternatives = 1

    if ('processLocally' in this.recognition) {
      this.recognition.processLocally = true
    }

    this.startRecognition('starting')
  }

  stop(): void {
    this.running = false
    this.manualStopping = true

    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }

    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {
        // ignore
      }
    }

    this.emitStatus('stopped')
  }

  destroy(): void {
    this.stop()

    if (this.recognition) {
      this.recognition.onstart = null
      this.recognition.onresult = null
      this.recognition.onerror = null
      this.recognition.onend = null

      try {
        this.recognition.abort()
      } catch {
        // ignore
      }
    }

    this.recognition = null
    this.emitStatus('idle')
  }

  private ensureRecognition(): void {
    if (this.recognition) {
      return
    }

    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }

    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!RecognitionCtor) {
      return
    }

    this.recognition = new RecognitionCtor()
    this.recognition.onstart = () => {
      this.emitStatus('listening')
    }

    this.recognition.onresult = (event: any) => {
      this.handleResult(event)
    }

    this.recognition.onerror = (event: any) => {
      if (this.manualStopping && event?.error === 'aborted') {
        return
      }

      const errorText = typeof event?.error === 'string' ? event.error : 'unknown'
      this.emitStatus('error')
      this.emitError(`语音识别错误: ${errorText}`)
    }

    this.recognition.onend = () => {
      if (!this.running) {
        this.emitStatus('stopped')
        return
      }

      if (this.manualStopping) {
        this.manualStopping = false
        return
      }

      this.startRecognition('restarting')
    }
  }

  private startRecognition(status: WakeWordStatus): void {
    if (!this.recognition || !this.running) {
      return
    }

    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }

    this.emitStatus(status)

    try {
      this.recognition.start()
    } catch (error) {
      this.restartTimer = setTimeout(() => {
        this.startRecognition('restarting')
      }, 500)

      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emitError(`语音监听启动失败: ${errorMessage}`)
    }
  }

  private handleResult(event: any): void {
    if (!this.running || !event?.results) {
      return
    }

    const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0

    for (let index = startIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      if (!result || !result[0] || !result.isFinal) {
        continue
      }

      const transcript = String(result[0].transcript || '').trim()
      if (!transcript) {
        continue
      }

      const matchedKeyword = this.matchKeyword(transcript)
      if (!matchedKeyword) {
        continue
      }

      const now = Date.now()
      if (now - this.lastDetectionAt < this.detectionCooldownMs) {
        continue
      }

      this.lastDetectionAt = now
      this.onWakeWord?.({
        keyword: matchedKeyword,
        transcript
      })
      return
    }
  }

  private matchKeyword(transcript: string): string | null {
    const normalizedTranscript = this.normalizeText(transcript)
    if (!normalizedTranscript) {
      return null
    }

    const matched = this.keywords.find((keyword) => normalizedTranscript.includes(keyword.normalized))
    return matched ? matched.original : null
  }

  private prepareKeywords(rawKeywords: string[]): Array<{ original: string; normalized: string }> {
    const keywords: Array<{ original: string; normalized: string }> = []

    for (const keyword of rawKeywords) {
      const trimmedKeyword = keyword.trim()
      if (!trimmedKeyword) {
        continue
      }

      const normalizedKeyword = this.normalizeText(trimmedKeyword)
      if (!normalizedKeyword) {
        continue
      }

      if (keywords.some((item) => item.normalized === normalizedKeyword)) {
        continue
      }

      keywords.push({
        original: trimmedKeyword,
        normalized: normalizedKeyword
      })
    }

    return keywords
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
  }

  private emitStatus(status: WakeWordStatus): void {
    this.onStatusChange?.(status)
  }

  private emitError(message: string): void {
    this.onError?.(message)
  }
}
