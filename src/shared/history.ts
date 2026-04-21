export interface HistoryResourceContext {
  resourceBaseUrl?: string
  resourcePath?: string
  resourceToken?: string
}

export interface HistoryMessageQueryOptions {
  limit?: number
  offset?: number
  startDate?: number
  endDate?: number
  messageType?: string
  direction?: string
  keyword?: string
  repairOffline?: boolean
  resourceContext?: HistoryResourceContext
}

export interface HistoryMessageRecord {
  messageId: string
  sessionId: string
  userId: string
  userName?: string
  messageType: 'friend' | 'group' | 'notify'
  direction: 'incoming' | 'outgoing' | 'input' | 'output'
  content: unknown
  rawText?: string
  timestamp: number
  resourceContext?: HistoryResourceContext
}

export interface HistoryGetMessagesResult {
  success: boolean
  data?: any[]
  total?: number
  repairedCount?: number
  error?: string
}

export interface HistorySaveMessageResult {
  success: boolean
  localizedContent?: any[]
  error?: string
}
