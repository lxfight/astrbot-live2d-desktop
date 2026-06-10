import { describe, expect, it } from 'vitest'
import { formatByteSize } from '@/utils/formatByteSize'

describe('formatByteSize', () => {
  it('formats zero and small values', () => {
    expect(formatByteSize(0)).toBe('0 B')
    expect(formatByteSize(512)).toBe('512 B')
  })

  it('formats kilobytes and megabytes', () => {
    expect(formatByteSize(1024)).toBe('1 KB')
    expect(formatByteSize(1536)).toBe('1.5 KB')
    expect(formatByteSize(5 * 1024 * 1024)).toBe('5 MB')
  })
})
