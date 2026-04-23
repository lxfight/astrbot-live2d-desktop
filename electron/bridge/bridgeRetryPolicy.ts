import type { ConnectionBehaviorSettingsPersistedV1 } from '../../src/shared/connectionBehaviorSettings'

export function calculateRetryDelayMs(
  settings: ConnectionBehaviorSettingsPersistedV1,
  reconnectAttempt: number,
): number {
  const normalizedAttempt = Math.max(1, reconnectAttempt)
  return Math.min(
    settings.retryBaseDelayMs * Math.pow(2, normalizedAttempt - 1),
    settings.retryMaxDelayMs,
  )
}
