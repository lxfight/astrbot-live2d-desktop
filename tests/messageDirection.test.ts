import { describe, expect, it } from 'vitest'
import { normalizeMessageDirection } from '../electron/database/messageDirection'

describe('messageDirection', () => {
  it('normalizes both legacy and current direction values', () => {
    expect(normalizeMessageDirection('incoming')).toBe('incoming')
    expect(normalizeMessageDirection('output')).toBe('incoming')
    expect(normalizeMessageDirection('outgoing')).toBe('outgoing')
    expect(normalizeMessageDirection('input')).toBe('outgoing')
  })

  it('returns null for unsupported values', () => {
    expect(normalizeMessageDirection('sideways')).toBeNull()
    expect(normalizeMessageDirection(undefined)).toBeNull()
  })
})
