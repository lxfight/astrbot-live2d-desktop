import { describe, expect, it } from 'vitest'
import { buildMessageKeywordSearchCondition } from '../electron/database/messageSearch'

describe('messageSearch', () => {
  it('uses FTS for keywords with at least 3 characters', () => {
    const condition = buildMessageKeywordSearchCondition('hello world')
    expect(condition).toEqual({
      clause: ' AND id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)',
      params: ['"hello world"']
    })
  })

  it('falls back to LIKE for short keywords', () => {
    const condition = buildMessageKeywordSearchCondition('hi')
    expect(condition).toEqual({
      clause: ' AND raw_text LIKE ?',
      params: ['%hi%']
    })
  })

  it('returns no condition for empty keywords', () => {
    expect(buildMessageKeywordSearchCondition('   ')).toEqual({ clause: '', params: [] })
  })
})
