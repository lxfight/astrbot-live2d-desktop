import type { BridgeLifecycleErrorCode } from '../../src/shared/bridgeLifecycle'
import type { BridgeClientDisconnectInfo, BridgeClientError } from '../protocol/client'

export interface BridgeFailure {
  code: BridgeLifecycleErrorCode
  message: string
  retryable: boolean
  closeCode?: number
  closeReason?: string
}

function isBridgeClientError(error: unknown): error is BridgeClientError {
  return Boolean(error) && typeof error === 'object' && typeof (error as BridgeClientError).code === 'string'
}

export function classifyConnectError(error: unknown): BridgeFailure {
  if (isBridgeClientError(error)) {
    const retryable = error.code !== 'INVALID_URL'
      && error.code !== 'TOKEN_REQUIRED'
      && error.code !== 'AUTH_FAILED'
      && error.code !== 'VERSION_MISMATCH'
    return {
      code: error.code,
      message: error.message,
      retryable,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'WS_CONNECT_FAILED',
      message: error.message,
      retryable: true,
    }
  }

  return {
    code: 'UNKNOWN',
    message: String(error),
    retryable: true,
  }
}

export function classifyDisconnect(info: BridgeClientDisconnectInfo): BridgeFailure {
  const code = info.errorCode || 'WS_UNEXPECTED_CLOSE'
  const message = info.errorMessage || `连接已断开: ${info.reason || info.code}`
  const retryable = code !== 'AUTH_FAILED' && code !== 'VERSION_MISMATCH'

  return {
    code,
    message,
    retryable,
    closeCode: info.code,
    closeReason: info.reason,
  }
}
