let messageIdSequence = 0

export function generateMessageId(prefix = 'msg'): string {
  messageIdSequence += 1
  const randomSegment = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${messageIdSequence}_${randomSegment}`
}
