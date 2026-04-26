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
import { createScopedLogger, type LogMeta } from '../utils/logger'

type LifecycleEventMap = {
  stateChanged: (snapshot: BridgeLifecycleSnapshot) => void
  'perform:show': (payload: unknown) => void
  'perform:interrupt': () => void
  'stt:result': (payload: unknown) => void
}

type DisconnectSource = 'manual' | 'socket-close' | 'socket-error' | 'system-suspend' | 'settings-changed'
type ConnectReason = 'startup' | 'manual' | 'retry' | 'resume' | 'settings-changed'

const logger = createScopedLogger('bridge.lifecycle')

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

function summarizeSnapshot(snapshot: BridgeLifecycleSnapshot): LogMeta {
  return {
    status: snapshot.status,
    desiredState: snapshot.desiredState,
    reconnectAttempt: snapshot.reconnectAttempt,
    nextRetryAt: snapshot.nextRetryAt,
    suspendReason: snapshot.suspendReason,
    activeConfigRevision: snapshot.activeConfigRevision,
    serverUrl: snapshot.serverUrl,
    hasToken: snapshot.hasToken,
    sessionId: snapshot.session?.sessionId,
    lastError: snapshot.lastError
      ? {
          code: snapshot.lastError.code,
          message: snapshot.lastError.message,
          retryable: snapshot.lastError.retryable,
          at: snapshot.lastError.at,
        }
      : null,
    lastDisconnect: snapshot.lastDisconnect,
  }
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
      logger.debug('initialize.skipped', { reason: 'already_initialized' })
      return
    }

    logger.info('initialize.start')
    const connectionLoadResult = loadConnectionSettings()
    if (connectionLoadResult.success) {
      this.currentSettings = connectionLoadResult.data
      logger.debug('settings.load.success', {
        revision: this.currentSettings.revision,
        serverUrl: this.currentSettings.serverUrl,
        hasToken: Boolean(this.currentSettings.token.trim()),
      })
    } else {
      console.error('[BridgeConnectionController] 读取连接配置失败:', connectionLoadResult.code, connectionLoadResult.message)
      logger.warn('settings.load.failed', {
        code: connectionLoadResult.code,
        message: connectionLoadResult.message,
      })
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
    logger.info('initialize.success', {
      startupDecisionPending: this.startupDecisionPending,
      autoConnectOnAppLaunch: this.behaviorSettings.autoConnectOnAppLaunch,
      snapshot: summarizeSnapshot(this.snapshot),
    })

    if (!this.startupDecisionPending && this.behaviorSettings.autoConnectOnAppLaunch) {
      this.applySnapshot({ desiredState: 'connected' })
      await this.openCurrentSettings('startup')
    }
  }

  dispose(): void {
    logger.info('dispose.start', { snapshot: summarizeSnapshot(this.snapshot) })
    this.cancelRetryTimer()
    this.closePendingClient()
    this.closeActiveClient()
    logger.info('dispose.success')
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
    logger.info('connect.requested', {
      serverUrl: this.currentSettings.serverUrl,
      hasToken: Boolean(this.currentSettings.token.trim()),
    })
    const validation = validateBridgeEndpointDraft({
      serverUrl: this.currentSettings.serverUrl,
      token: this.currentSettings.token,
    })

    if (!validation.valid) {
      logger.warn('connect.validation_failed', {
        code: validation.code,
        message: validation.message,
      })
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
    logger.info('disconnect.requested', { snapshot: summarizeSnapshot(this.snapshot) })
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
    const transportLayerChanged = isTransportLayerChanged(previousSettings, settings)

    logger.info('settings.updated', {
      previousRevision: previousSettings.revision,
      nextRevision: settings.revision,
      serverUrl: settings.serverUrl,
      hasToken: Boolean(settings.token.trim()),
      transportLayerChanged,
      desiredState: this.snapshot.desiredState,
    })

    this.applySnapshot({
      activeConfigRevision: settings.revision,
      serverUrl: settings.serverUrl,
      hasToken: Boolean(settings.token.trim()),
    })

    if (this.snapshot.desiredState !== 'connected') {
      return
    }

    if (transportLayerChanged) {
      await this.restartWithCurrentSettings('settings-changed')
    }
  }

  async handleBehaviorSettingsUpdated(
    settings: ConnectionBehaviorSettingsPersistedV1,
    options: { resolveStartupDecision?: boolean } = {},
  ): Promise<void> {
    this.behaviorSettings = settings
    logger.info('behavior_settings.updated', {
      resolveStartupDecision: Boolean(options.resolveStartupDecision),
      startupDecisionPending: this.startupDecisionPending,
      autoConnectOnAppLaunch: settings.autoConnectOnAppLaunch,
      retryEnabled: settings.retryEnabled,
      retryMaxAttempts: settings.retryMaxAttempts,
      resumeDesiredConnectionOnWake: settings.resumeDesiredConnectionOnWake,
    })

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
      logger.debug('system_suspend.ignored', {
        reason,
        desiredState: this.snapshot.desiredState,
        status: this.snapshot.status,
      })
      return
    }

    logger.info('system_suspend.start', { reason, snapshot: summarizeSnapshot(this.snapshot) })
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
      logger.debug('system_resume.ignored', {
        status: this.snapshot.status,
        desiredState: this.snapshot.desiredState,
      })
      return
    }

    logger.info('system_resume.start', { snapshot: summarizeSnapshot(this.snapshot) })
    this.applySnapshot({ suspendReason: null })
    await this.openCurrentSettings('resume')
  }

  async sendMessage(payload: InputMessagePayload): Promise<MessageContent[]> {
    if (!this.activeClient?.isReady()) {
      throw new Error('未连接到服务器')
    }

    logger.debug('send_message.start', {
      contentCount: Array.isArray(payload.content) ? payload.content.length : 0,
      sessionId: this.snapshot.session?.sessionId,
    })
    return await this.activeClient.sendMessage(payload)
  }

  sendTouch(x: number, y: number, action: string): void {
    if (!this.activeClient?.isReady()) {
      throw new Error('未连接到服务器')
    }

    logger.debug('send_touch', { x, y, action, sessionId: this.snapshot.session?.sessionId })
    this.activeClient.sendTouch(x, y, action)
  }

  sendState(op: string, payload: unknown): void {
    if (!this.activeClient?.isReady()) {
      throw new Error('未连接到服务器')
    }

    logger.debug('send_state', { op, sessionId: this.snapshot.session?.sessionId })
    this.activeClient.sendState(op, payload)
  }

  private async restartWithCurrentSettings(reason: ConnectReason): Promise<void> {
    logger.info('restart.start', { reason, snapshot: summarizeSnapshot(this.snapshot) })
    this.cancelRetryTimer()
    this.closePendingClient()
    this.closeActiveClient()
    await this.openCurrentSettings(reason)
  }

  private async openCurrentSettings(reason: ConnectReason): Promise<BridgeLifecycleCommandResult> {
    const timer = logger.timer('connect', {
      reason,
      serverUrl: this.currentSettings.serverUrl,
      configRevision: this.currentSettings.revision,
      hasToken: Boolean(this.currentSettings.token.trim()),
    })
    const validation = validateBridgeEndpointDraft({
      serverUrl: this.currentSettings.serverUrl,
      token: this.currentSettings.token,
    })

    if (!validation.valid) {
      timer.fail(new Error(validation.message), {
        code: validation.code,
        retryable: false,
      })
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
    logger.info('connect.start', {
      reason,
      generation,
      reconnectAttempt: reason === 'retry' ? this.snapshot.reconnectAttempt : 0,
      serverUrl: this.currentSettings.serverUrl,
      handshakeTimeoutMs: this.behaviorSettings.handshakeTimeoutMs,
    })
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
          logger.debug('socket.open', { generation, reason })
          this.applySnapshot({ status: 'handshaking' })
        },
      })

      if (generation !== this.currentGeneration || this.pendingClient !== candidateClient || this.snapshot.desiredState !== 'connected') {
        logger.warn('connect.superseded', {
          reason,
          generation,
          currentGeneration: this.currentGeneration,
          desiredState: this.snapshot.desiredState,
        })
        candidateClient.close()
        timer.done({ superseded: true, generation })
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
      logger.info('connect.success', {
        reason,
        generation,
        sessionId: session.sessionId,
        userId: session.userId,
      })
      timer.done({ generation, sessionId: session.sessionId })

      return {
        success: true,
        snapshot: this.getSnapshot(),
      }
    } catch (error) {
      if (generation !== this.currentGeneration) {
        logger.warn('connect.failed_superseded', {
          reason,
          generation,
          currentGeneration: this.currentGeneration,
        })
        timer.fail(error, { generation, superseded: true })
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
      logger.warn('connect.failed', {
        reason,
        generation,
        code: failure.code,
        message: failure.message,
        retryable: failure.retryable,
      })
      timer.fail(error, { generation, code: failure.code, retryable: failure.retryable })
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
    logger.debug('client.promote', { generation })
    this.activeClient = client

    const onDisconnected = (info: BridgeClientDisconnectInfo) => {
      if (generation !== this.currentGeneration || this.activeClient !== client) {
        return
      }

      logger.warn('client.disconnected', {
        generation,
        code: info.code,
        reason: info.reason,
        errorCode: info.errorCode,
        errorMessage: info.errorMessage,
      })
      this.activeClient = null
      this.clearActiveClientListeners()
      const failure = classifyDisconnect(info)
      this.applyFailure(failure, 'socket-close')
    }

    const onPerformShow = (payload: unknown) => {
      if (generation === this.currentGeneration && this.activeClient === client) {
        logger.debug('perform_show.received', { generation, payload })
        this.emit('perform:show', payload)
      }
    }

    const onPerformInterrupt = () => {
      if (generation === this.currentGeneration && this.activeClient === client) {
        logger.info('perform_interrupt.received', { generation })
        this.emit('perform:interrupt')
      }
    }

    const onSttResult = (payload: unknown) => {
      if (generation === this.currentGeneration && this.activeClient === client) {
        logger.debug('stt_result.received', { generation, payload })
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

    logger.debug('pending_client.close')
    const pendingClient = this.pendingClient
    this.pendingClient = null
    pendingClient.close()
  }

  private closeActiveClient(): void {
    if (!this.activeClient) {
      return
    }

    logger.debug('active_client.close')
    const activeClient = this.activeClient
    this.clearActiveClientListeners()
    this.activeClient = null
    activeClient.close()
  }

  private cancelRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
      logger.debug('retry.cancel')
    }
  }

  private scheduleRetry(failure: BridgeFailure): void {
    if (this.snapshot.desiredState !== 'connected' || !failure.retryable || !this.behaviorSettings.retryEnabled) {
      logger.warn('retry.skip', {
        desiredState: this.snapshot.desiredState,
        retryable: failure.retryable,
        retryEnabled: this.behaviorSettings.retryEnabled,
        code: failure.code,
      })
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
      logger.warn('retry.max_attempts_reached', {
        nextAttempt,
        retryMaxAttempts: this.behaviorSettings.retryMaxAttempts,
        code: failure.code,
      })
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
    logger.info('retry.schedule', {
      attempt: nextAttempt,
      delayMs: delay,
      nextRetryAt,
      code: failure.code,
      message: failure.message,
    })
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
    logger.warn('failure.apply', {
      disconnectSource,
      code: failure.code,
      message: failure.message,
      retryable: failure.retryable,
      desiredState: this.snapshot.desiredState,
    })
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
    const previousSnapshot = this.snapshot
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      updatedAt: Date.now(),
    }
    const stateChanged = previousSnapshot.status !== this.snapshot.status
      || previousSnapshot.desiredState !== this.snapshot.desiredState
      || previousSnapshot.reconnectAttempt !== this.snapshot.reconnectAttempt
      || previousSnapshot.nextRetryAt !== this.snapshot.nextRetryAt
      || previousSnapshot.suspendReason !== this.snapshot.suspendReason

    const event = stateChanged ? 'state.changed' : 'state.updated'
    logger.debug(event, {
      patch,
      previous: summarizeSnapshot(previousSnapshot),
      next: summarizeSnapshot(this.snapshot),
    })
    this.emit('stateChanged', this.getSnapshot())
  }
}
