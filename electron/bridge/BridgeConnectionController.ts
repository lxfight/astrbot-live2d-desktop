import { EventEmitter } from 'events'
import type { ConnectionSettingsPersistedV3 } from '../../src/shared/connectionSettings'
import type { ConnectionBehaviorSettingsPersistedV1 } from '../../src/shared/connectionBehaviorSettings'
import {
  buildDefaultBridgeLifecycleSnapshot,
  type BridgeLifecycleCommandResult,
  type BridgeLifecycleSnapshot,
} from '../../src/shared/bridgeLifecycle'
import { validateBridgeEndpointDraft } from '../../src/shared/bridgeConnectionValidation'
import { buildDefaultConnectionSettingsSnapshot, loadConnectionSettings } from '../services/connectionSettingsService'
import { loadConnectionBehaviorSettingsRecord } from '../services/connectionBehaviorSettingsService'
import { L2DBridgeClient, type BridgeClientDisconnectInfo } from '../protocol/client'
import type { InputMessagePayload, MessageContent } from '../protocol/types'
import { classifyConnectError, classifyDisconnect, type BridgeFailure } from './bridgeFailureClassifier'
import { calculateRetryDelayMs } from './bridgeRetryPolicy'

type LifecycleEventMap = {
  stateChanged: (snapshot: BridgeLifecycleSnapshot) => void
  'perform:show': (payload: unknown) => void
  'perform:interrupt': () => void
  'stt:result': (payload: unknown) => void
}

type DisconnectSource = 'manual' | 'socket-close' | 'socket-error' | 'system-suspend' | 'settings-changed'
type ConnectReason = 'startup' | 'manual' | 'retry' | 'resume' | 'settings-changed'

function toDisconnectEvent(source: DisconnectSource, failure?: BridgeFailure): BridgeLifecycleSnapshot['lastDisconnect'] {
  return {
    source,
    code: failure?.closeCode,
    reason: failure?.closeReason,
    at: Date.now(),
  }
}

function isTransportLayerChanged(
  previousSettings: ConnectionSettingsPersistedV3,
  nextSettings: ConnectionSettingsPersistedV3,
): boolean {
  return previousSettings.serverUrl !== nextSettings.serverUrl
    || previousSettings.token !== nextSettings.token
}

export class BridgeConnectionController extends EventEmitter {
  private snapshot = buildDefaultBridgeLifecycleSnapshot()
  private behaviorSettings: ConnectionBehaviorSettingsPersistedV1 = loadConnectionBehaviorSettingsRecord().settings
  private startupDecisionPending = true
  private initialized = false
  private hasUserDrivenAction = false
  private currentSettings: ConnectionSettingsPersistedV3 = buildDefaultConnectionSettingsSnapshot()
  private retryTimer: NodeJS.Timeout | null = null
  private currentGeneration = 0
  private pendingClient: L2DBridgeClient | null = null
  private activeClient: L2DBridgeClient | null = null
  private activeClientListeners: Array<{ event: string; listener: (...args: any[]) => void }> = []

  override on<K extends keyof LifecycleEventMap>(eventName: K, listener: LifecycleEventMap[K]): this {
    return super.on(eventName, listener)
  }

  override emit<K extends keyof LifecycleEventMap>(eventName: K, ...args: Parameters<LifecycleEventMap[K]>): boolean {
    return super.emit(eventName, ...args)
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    const connectionLoadResult = loadConnectionSettings()
    if (connectionLoadResult.success) {
      this.currentSettings = connectionLoadResult.data
    } else {
      console.error('[BridgeConnectionController] 读取连接配置失败:', connectionLoadResult.code, connectionLoadResult.message)
      this.currentSettings = buildDefaultConnectionSettingsSnapshot()
    }

    const behaviorRecord = loadConnectionBehaviorSettingsRecord()
    this.behaviorSettings = behaviorRecord.settings
    this.startupDecisionPending = !behaviorRecord.exists

    this.applySnapshot({
      activeConfigRevision: this.currentSettings.revision,
      serverUrl: this.currentSettings.serverUrl,
      hasToken: Boolean(this.currentSettings.token.trim()),
    })

    this.initialized = true

    if (!this.startupDecisionPending && this.behaviorSettings.autoConnectOnAppLaunch) {
      this.applySnapshot({ desiredState: 'connected' })
      await this.openCurrentSettings('startup')
    }
  }

  dispose(): void {
    this.cancelRetryTimer()
    this.closePendingClient()
    this.closeActiveClient()
  }

  getSnapshot(): BridgeLifecycleSnapshot {
    return { ...this.snapshot }
  }

  getSession() {
    return this.snapshot.session
  }

  isConnected(): boolean {
    return this.snapshot.status === 'connected' && !!this.activeClient?.isReady()
  }

  async connect(): Promise<BridgeLifecycleCommandResult> {
    const validation = validateBridgeEndpointDraft({
      serverUrl: this.currentSettings.serverUrl,
      token: this.currentSettings.token,
    })

    if (!validation.valid) {
      return {
        success: false,
        code: validation.code,
        message: validation.message,
        snapshot: this.getSnapshot(),
      }
    }

    this.hasUserDrivenAction = true
    this.applySnapshot({
      desiredState: 'connected',
      suspendReason: null,
    })

    return await this.openCurrentSettings('manual')
  }

  async disconnect(): Promise<BridgeLifecycleCommandResult> {
    this.hasUserDrivenAction = true
    this.cancelRetryTimer()
    this.closePendingClient()
    this.closeActiveClient()

    this.applySnapshot({
      status: 'idle',
      desiredState: 'disconnected',
      session: null,
      reconnectAttempt: 0,
      nextRetryAt: null,
      suspendReason: null,
      lastError: null,
      lastDisconnect: toDisconnectEvent('manual'),
    })

    return {
      success: true,
      snapshot: this.getSnapshot(),
    }
  }

  async handleConnectionSettingsUpdated(settings: ConnectionSettingsPersistedV3): Promise<void> {
    const previousSettings = this.currentSettings
    this.currentSettings = settings

    this.applySnapshot({
      activeConfigRevision: settings.revision,
      serverUrl: settings.serverUrl,
      hasToken: Boolean(settings.token.trim()),
    })

    if (this.snapshot.desiredState !== 'connected') {
      return
    }

    if (isTransportLayerChanged(previousSettings, settings)) {
      await this.restartWithCurrentSettings('settings-changed')
    }
  }

  async handleBehaviorSettingsUpdated(
    settings: ConnectionBehaviorSettingsPersistedV1,
    options: { resolveStartupDecision?: boolean } = {},
  ): Promise<void> {
    this.behaviorSettings = settings

    if (options.resolveStartupDecision && this.startupDecisionPending) {
      this.startupDecisionPending = false
      if (!this.hasUserDrivenAction && settings.autoConnectOnAppLaunch && this.snapshot.desiredState === 'disconnected') {
        this.applySnapshot({ desiredState: 'connected' })
        await this.openCurrentSettings('startup')
        return
      }
    }

    if (this.snapshot.status === 'waiting_retry' && this.snapshot.desiredState === 'connected') {
      if (!settings.retryEnabled) {
        this.cancelRetryTimer()
        this.applySnapshot({
          status: 'error',
          nextRetryAt: null,
        })
      } else {
        this.scheduleRetry({
          code: this.snapshot.lastError?.code || 'WS_UNEXPECTED_CLOSE',
          message: this.snapshot.lastError?.message || '连接已断开',
          retryable: true,
        })
      }
      return
    }

    if (
      this.snapshot.status === 'error'
      && this.snapshot.desiredState === 'connected'
      && this.snapshot.lastError?.retryable
      && settings.retryEnabled
    ) {
      this.scheduleRetry({
        code: this.snapshot.lastError.code,
        message: this.snapshot.lastError.message,
        retryable: true,
      })
    }
  }

  async handleSystemSuspend(reason: 'lock-screen' | 'suspend'): Promise<void> {
    if (this.snapshot.desiredState !== 'connected') {
      return
    }

    this.cancelRetryTimer()
    this.closePendingClient()
    this.closeActiveClient()

    if (this.behaviorSettings.resumeDesiredConnectionOnWake) {
      this.applySnapshot({
        status: 'suspended',
        session: null,
        nextRetryAt: null,
        suspendReason: reason,
        lastDisconnect: toDisconnectEvent('system-suspend'),
      })
      return
    }

    this.applySnapshot({
      status: 'idle',
      desiredState: 'disconnected',
      session: null,
      reconnectAttempt: 0,
      nextRetryAt: null,
      suspendReason: null,
      lastError: null,
      lastDisconnect: toDisconnectEvent('system-suspend'),
    })
  }

  async handleSystemResume(): Promise<void> {
    if (this.snapshot.status !== 'suspended' || this.snapshot.desiredState !== 'connected') {
      return
    }

    this.applySnapshot({ suspendReason: null })
    await this.openCurrentSettings('resume')
  }

  async sendMessage(payload: InputMessagePayload): Promise<MessageContent[]> {
    if (!this.activeClient?.isReady()) {
      throw new Error('未连接到服务器')
    }

    return await this.activeClient.sendMessage(payload)
  }

  sendTouch(x: number, y: number, action: string): void {
    if (!this.activeClient?.isReady()) {
      throw new Error('未连接到服务器')
    }

    this.activeClient.sendTouch(x, y, action)
  }

  sendState(op: string, payload: unknown): void {
    if (!this.activeClient?.isReady()) {
      throw new Error('未连接到服务器')
    }

    this.activeClient.sendState(op, payload)
  }

  private async restartWithCurrentSettings(reason: ConnectReason): Promise<void> {
    this.cancelRetryTimer()
    this.closePendingClient()
    this.closeActiveClient()
    await this.openCurrentSettings(reason)
  }

  private async openCurrentSettings(reason: ConnectReason): Promise<BridgeLifecycleCommandResult> {
    const validation = validateBridgeEndpointDraft({
      serverUrl: this.currentSettings.serverUrl,
      token: this.currentSettings.token,
    })

    if (!validation.valid) {
      this.applyFailure(
        {
          code: validation.code,
          message: validation.message,
          retryable: false,
        },
        reason === 'settings-changed' ? 'settings-changed' : 'socket-error',
      )

      return {
        success: false,
        code: validation.code,
        message: validation.message,
        snapshot: this.getSnapshot(),
      }
    }

    const generation = ++this.currentGeneration
    this.cancelRetryTimer()
    this.closePendingClient()
    this.closeActiveClient()

    const reconnectAttempt = reason === 'retry' ? this.snapshot.reconnectAttempt : 0
    this.applySnapshot({
      status: 'connecting',
      desiredState: 'connected',
      session: null,
      reconnectAttempt,
      nextRetryAt: null,
      suspendReason: null,
      lastError: null,
      activeConfigRevision: this.currentSettings.revision,
      serverUrl: this.currentSettings.serverUrl,
      hasToken: Boolean(this.currentSettings.token.trim()),
    })

    const candidateClient = new L2DBridgeClient()
    this.pendingClient = candidateClient

    try {
      const session = await candidateClient.open({
        url: this.currentSettings.serverUrl,
        token: this.currentSettings.token,
        handshakeTimeoutMs: this.behaviorSettings.handshakeTimeoutMs,
        onSocketOpen: () => {
          if (generation !== this.currentGeneration || this.pendingClient !== candidateClient) {
            return
          }
          this.applySnapshot({ status: 'handshaking' })
        },
      })

      if (generation !== this.currentGeneration || this.pendingClient !== candidateClient || this.snapshot.desiredState !== 'connected') {
        candidateClient.close()
        return {
          success: true,
          snapshot: this.getSnapshot(),
        }
      }

      this.pendingClient = null
      this.promoteActiveClient(candidateClient, generation)
      this.applySnapshot({
        status: 'connected',
        session,
        reconnectAttempt: 0,
        nextRetryAt: null,
        suspendReason: null,
        lastError: null,
      })

      return {
        success: true,
        snapshot: this.getSnapshot(),
      }
    } catch (error) {
      if (generation !== this.currentGeneration) {
        return {
          success: false,
          code: 'CLIENT_UNAVAILABLE',
          message: '连接请求已被更新的生命周期操作取代',
          snapshot: this.getSnapshot(),
        }
      }

      if (this.pendingClient === candidateClient) {
        this.pendingClient = null
      }
      candidateClient.close()

      const failure = classifyConnectError(error)
      this.applyFailure(failure, 'socket-error')

      return {
        success: false,
        code: failure.code,
        message: failure.message,
        snapshot: this.getSnapshot(),
      }
    }
  }

  private promoteActiveClient(client: L2DBridgeClient, generation: number): void {
    this.activeClient = client

    const onDisconnected = (info: BridgeClientDisconnectInfo) => {
      if (generation !== this.currentGeneration || this.activeClient !== client) {
        return
      }

      this.activeClient = null
      this.clearActiveClientListeners()
      const failure = classifyDisconnect(info)
      this.applyFailure(failure, 'socket-close')
    }

    const onPerformShow = (payload: unknown) => {
      if (generation === this.currentGeneration && this.activeClient === client) {
        this.emit('perform:show', payload)
      }
    }

    const onPerformInterrupt = () => {
      if (generation === this.currentGeneration && this.activeClient === client) {
        this.emit('perform:interrupt')
      }
    }

    const onSttResult = (payload: unknown) => {
      if (generation === this.currentGeneration && this.activeClient === client) {
        this.emit('stt:result', payload)
      }
    }

    client.on('disconnected', onDisconnected)
    client.on('perform:show', onPerformShow)
    client.on('perform:interrupt', onPerformInterrupt)
    client.on('stt:result', onSttResult)

    this.activeClientListeners = [
      { event: 'disconnected', listener: onDisconnected },
      { event: 'perform:show', listener: onPerformShow },
      { event: 'perform:interrupt', listener: onPerformInterrupt },
      { event: 'stt:result', listener: onSttResult },
    ]
  }

  private clearActiveClientListeners(): void {
    if (!this.activeClient) {
      this.activeClientListeners = []
      return
    }

    for (const { event, listener } of this.activeClientListeners) {
      this.activeClient.off(event, listener)
    }
    this.activeClientListeners = []
  }

  private closePendingClient(): void {
    if (!this.pendingClient) {
      return
    }

    const pendingClient = this.pendingClient
    this.pendingClient = null
    pendingClient.close()
  }

  private closeActiveClient(): void {
    if (!this.activeClient) {
      return
    }

    const activeClient = this.activeClient
    this.clearActiveClientListeners()
    this.activeClient = null
    activeClient.close()
  }

  private cancelRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private scheduleRetry(failure: BridgeFailure): void {
    if (this.snapshot.desiredState !== 'connected' || !failure.retryable || !this.behaviorSettings.retryEnabled) {
      this.applySnapshot({
        status: 'error',
        nextRetryAt: null,
      })
      return
    }

    const nextAttempt = Math.max(1, this.snapshot.reconnectAttempt + 1)
    if (
      this.behaviorSettings.retryMaxAttempts !== null
      && nextAttempt > this.behaviorSettings.retryMaxAttempts
    ) {
      this.applySnapshot({
        status: 'error',
        reconnectAttempt: nextAttempt - 1,
        nextRetryAt: null,
      })
      return
    }

    this.cancelRetryTimer()

    const delay = calculateRetryDelayMs(this.behaviorSettings, nextAttempt)
    const nextRetryAt = Date.now() + delay
    this.applySnapshot({
      status: 'waiting_retry',
      reconnectAttempt: nextAttempt,
      nextRetryAt,
    })

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.snapshot.desiredState !== 'connected') {
        return
      }
      void this.openCurrentSettings('retry')
    }, delay)
  }

  private applyFailure(failure: BridgeFailure, disconnectSource: DisconnectSource): void {
    this.cancelRetryTimer()
    this.closePendingClient()

    this.applySnapshot({
      session: null,
      lastError: {
        code: failure.code,
        message: failure.message,
        retryable: failure.retryable,
        at: Date.now(),
      },
      lastDisconnect: toDisconnectEvent(disconnectSource, failure),
      nextRetryAt: null,
      suspendReason: null,
    })

    if (failure.retryable && this.snapshot.desiredState === 'connected' && this.behaviorSettings.retryEnabled) {
      this.scheduleRetry(failure)
      return
    }

    this.applySnapshot({
      status: 'error',
      nextRetryAt: null,
    })
  }

  private applySnapshot(patch: Partial<BridgeLifecycleSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      updatedAt: Date.now(),
    }
    this.emit('stateChanged', this.getSnapshot())
  }
}
