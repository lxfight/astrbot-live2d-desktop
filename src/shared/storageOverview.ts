export interface StorageResourceBreakdownItem {
  mediaType: string
  count: number
  totalBytes: number
}

export interface StorageOverview {
  appDataPath: string
  storageMode: 'development' | 'installed' | 'portable'
  databaseFileBytes: number
  databaseVersion: number
  messageCount: number
  sessionCount: number
  performanceCount: number
  performanceInterruptedCount: number
  resourceCount: number
  resourceTotalBytes: number
  resourceDedupSha256Count: number
  resourceBreakdown: StorageResourceBreakdownItem[]
  earliestMessageTimestamp: number | null
  latestMessageTimestamp: number | null
  logDirectoryBytes: number
  logFileCount: number
  cubismCoreBytes: number
  cubismCoreInstalled: boolean
  modelsDirectoryBytes: number
  modelLibraryCount: number
}
