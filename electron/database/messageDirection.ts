export type MessageDirection = 'incoming' | 'outgoing'

export function normalizeMessageDirection(value: unknown): MessageDirection | null {
  switch (String(value || '').trim().toLowerCase()) {
    case 'incoming':
    case 'output':
      return 'incoming'
    case 'outgoing':
    case 'input':
      return 'outgoing'
    default:
      return null
  }
}
