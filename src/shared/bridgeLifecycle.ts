import type { ConnectionSettingsEditable, ConnectionSettingsErrorCode } from './connectionSettings'

export interface BridgeSessionState {
  sessionId: string
  userId: string
  config: {
    resourceBaseUrl?: string
    resourcePath?: string
    maxInlineBytes?: number
  }
}

export type BridgeLifecycleStatus =
  | 'idle'
  | 'connecting'
  | 'handshaking'
  | 'connected'
  | 'waiting_retry'
  | 'suspended'
  | 'error'

export type BridgeDesiredState = 'connected' | 'disconnected'

export type BridgeLifecycleErrorCode =
  | 'INVALID_URL'
  | 'TOKEN_REQUIRED'
  | 'HANDSHAKE_TIMEOUT'
  | 'AUTH_FAILED'
  | 'VERSION_MISMATCH'
  | 'WS_CONNECT_FAILED'
  | 'WS_UNEXPECTED_CLOSE'
  | 'CLIENT_UNAVAILABLE'
  | 'UNKNOWN'

export interface BridgeLifecycleSnapshot {
  status: BridgeLifecycleStatus
  desiredState: BridgeDesiredState
  activeConfigRevision: number
  serverUrl: string
  hasToken: boolean
  session: BridgeSessionState | null
  reconnectAttempt: number
  nextRetryAt: number | null
  suspendReason: 'lock-screen' | 'suspend' | null
  lastError: {
    code: BridgeLifecycleErrorCode
    message: string
    retryable: boolean
    at: number
  } | null
  lastDisconnect: {
    source: 'manual' | 'socket-close' | 'socket-error' | 'system-suspend' | 'settings-changed'
    code?: number
    reason?: string
    at: number
  } | null
  updatedAt: number
}

export interface BridgeLifecycleConnectRequest {
  draftSettings?: ConnectionSettingsEditable
  expectedRevision?: number
}

export type BridgeLifecycleCommandResult =
  | {
      success: true
      snapshot: BridgeLifecycleSnapshot
    }
  | {
      success: false
      code: BridgeLifecycleErrorCode | ConnectionSettingsErrorCode
      message: string
      snapshot: BridgeLifecycleSnapshot
    }

export function buildDefaultBridgeLifecycleSnapshot(): BridgeLifecycleSnapshot {
  return {
    status: 'idle',
    desiredState: 'disconnected',
    activeConfigRevision: 0,
    serverUrl: '',
    hasToken: false,
    session: null,
    reconnectAttempt: 0,
    nextRetryAt: null,
    suspendReason: null,
    lastError: null,
    lastDisconnect: null,
    updatedAt: Date.now(),
  }
}
