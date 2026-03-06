const FTS_MIN_KEYWORD_LENGTH = 3

export interface MessageKeywordSearchCondition {
  clause: string
  params: string[]
}

function normalizeKeyword(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function escapeFtsPhrase(value: string): string {
  return value.replace(/"/g, '""')
}

export function buildMessageKeywordSearchCondition(keyword: unknown): MessageKeywordSearchCondition {
  const normalizedKeyword = normalizeKeyword(keyword)
  if (!normalizedKeyword) {
    return { clause: '', params: [] }
  }

  if (normalizedKeyword.length >= FTS_MIN_KEYWORD_LENGTH) {
    return {
      clause: ' AND id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)',
      params: [`"${escapeFtsPhrase(normalizedKeyword)}"`]
    }
  }

  return {
    clause: ' AND raw_text LIKE ?',
    params: [`%${normalizedKeyword}%`]
  }
}
