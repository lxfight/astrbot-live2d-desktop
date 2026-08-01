import type { PerformEmotionIntent, PerformSequence } from '@/types/protocol'

export type PerformEmotionTrigger =
  | { type: 'intent'; intent: PerformEmotionIntent }
  | { type: 'message'; message: string }
  | null

export function resolvePerformEmotionTrigger(payload: PerformSequence): PerformEmotionTrigger {
  if (payload.emotion?.emotion?.trim()) {
    return { type: 'intent', intent: payload.emotion }
  }

  const seen = new Set<string>()
  const textParts: string[] = []
  for (const element of payload.sequence ?? []) {
    const candidate =
      element.type === 'text'
        ? element.content
        : element.type === 'tts'
          ? element.text || element.content
          : undefined
    const normalized = candidate?.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    textParts.push(normalized)
  }

  const message = textParts.join('\n').slice(0, 4000)
  return message ? { type: 'message', message } : null
}
