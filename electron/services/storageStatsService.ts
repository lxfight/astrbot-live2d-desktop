import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type {
  StorageOverview,
  StorageResourceBreakdownItem
} from '../../src/shared/storageOverview'
import { getDatabase, getMessagesCount } from '../database/schema'
import { getAppDataPath, getAppDataPathContext } from '../utils/appPaths'
import { getCubismCorePath, resolveExistingCubismCorePath } from '../utils/downloadCubismCore'
import { getLogDirectoryPath } from '../utils/logger'

const LOG_FILE_PATTERN = /^astrbot-live2d-\d{4}-\d{2}-\d{2}(?:\.\d+)?\.log$/

function safeStatFileSize(filePath: string): number {
  try {
    if (!fs.existsSync(filePath)) {
      return 0
    }

    const stat = fs.statSync(filePath)
    return stat.isFile() ? stat.size : 0
  } catch {
    return 0
  }
}

function sumDirectoryBytes(rootDir: string, maxDepth = 12): number {
  if (!fs.existsSync(rootDir)) {
    return 0
  }

  let total = 0

  function walk(currentDir: string, depth: number): void {
    if (depth > maxDepth) {
      return
    }

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      try {
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1)
          continue
        }

        if (entry.isFile()) {
          total += fs.statSync(fullPath).size
        }
      } catch {
        // skip unreadable entries
      }
    }
  }

  walk(rootDir, 0)
  return total
}

function sumLogDirectoryBytes(logDir: string): { totalBytes: number; fileCount: number } {
  if (!fs.existsSync(logDir)) {
    return { totalBytes: 0, fileCount: 0 }
  }

  let totalBytes = 0
  let fileCount = 0

  for (const entry of fs.readdirSync(logDir, { withFileTypes: true })) {
    if (!entry.isFile() || !LOG_FILE_PATTERN.test(entry.name)) {
      continue
    }

    try {
      totalBytes += fs.statSync(path.join(logDir, entry.name)).size
      fileCount += 1
    } catch {
      // skip
    }
  }

  return { totalBytes, fileCount }
}

function getModelsDir(): string {
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'public', 'models')
  }

  return path.join(getAppDataPath(), 'models')
}

function countModelLibraryEntries(modelsDir: string): number {
  if (!fs.existsSync(modelsDir)) {
    return 0
  }

  let count = 0
  for (const entry of fs.readdirSync(modelsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const modelDir = path.join(modelsDir, entry.name)
    try {
      const hasModel3 = fs
        .readdirSync(modelDir)
        .some(name => name.toLowerCase().endsWith('.model3.json'))
      if (hasModel3) {
        count += 1
      }
    } catch {
      // skip
    }
  }

  return count
}

function readDatabaseVersion(): number {
  try {
    const db = getDatabase()
    const version = db.pragma('user_version', { simple: true })
    return Number.isFinite(version) ? Math.max(0, Math.floor(Number(version))) : 0
  } catch {
    return 0
  }
}

export function getStorageOverview(): StorageOverview {
  const db = getDatabase()
  const appDataPath = getAppDataPath()
  const dbPath = path.join(appDataPath, 'history.db')

  const messageRow = db
    .prepare(
      `
    SELECT
      COUNT(DISTINCT session_id) AS session_count,
      MIN(timestamp) AS earliest_ts,
      MAX(timestamp) AS latest_ts
    FROM messages
  `
    )
    .get() as {
    session_count?: number
    earliest_ts?: number | null
    latest_ts?: number | null
  }

  const performanceRow = db
    .prepare(
      `
    SELECT
      COUNT(*) AS performance_count,
      COALESCE(SUM(interrupted), 0) AS interrupted_count
    FROM performances
  `
    )
    .get() as { performance_count?: number; interrupted_count?: number }

  const resourceTotals = db
    .prepare(
      `
    SELECT
      COUNT(*) AS resource_count,
      COALESCE(SUM(size_bytes), 0) AS total_bytes,
      COUNT(DISTINCT sha256) AS dedup_count
    FROM message_resources
  `
    )
    .get() as { resource_count?: number; total_bytes?: number; dedup_count?: number }

  const breakdownRows = db
    .prepare(
      `
    SELECT
      media_type,
      COUNT(*) AS item_count,
      COALESCE(SUM(size_bytes), 0) AS total_bytes
    FROM message_resources
    GROUP BY media_type
    ORDER BY total_bytes DESC
  `
    )
    .all() as Array<{ media_type: string; item_count: number; total_bytes: number }>

  const resourceBreakdown: StorageResourceBreakdownItem[] = breakdownRows.map(row => ({
    mediaType: row.media_type,
    count: row.item_count,
    totalBytes: row.total_bytes
  }))

  const modelsDir = getModelsDir()
  const logDir = getLogDirectoryPath()
  const logStats = sumLogDirectoryBytes(logDir)
  const cubismCorePath = resolveExistingCubismCorePath() ?? getCubismCorePath()
  const cubismInstalled = Boolean(resolveExistingCubismCorePath())

  return {
    appDataPath,
    storageMode: getAppDataPathContext().mode,
    databaseFileBytes: safeStatFileSize(dbPath),
    databaseVersion: readDatabaseVersion(),
    messageCount: getMessagesCount({}),
    sessionCount: messageRow?.session_count ?? 0,
    performanceCount: performanceRow?.performance_count ?? 0,
    performanceInterruptedCount: performanceRow?.interrupted_count ?? 0,
    resourceCount: resourceTotals?.resource_count ?? 0,
    resourceTotalBytes: resourceTotals?.total_bytes ?? 0,
    resourceDedupSha256Count: resourceTotals?.dedup_count ?? 0,
    resourceBreakdown,
    earliestMessageTimestamp:
      typeof messageRow?.earliest_ts === 'number' ? messageRow.earliest_ts : null,
    latestMessageTimestamp: typeof messageRow?.latest_ts === 'number' ? messageRow.latest_ts : null,
    logDirectoryBytes: logStats.totalBytes,
    logFileCount: logStats.fileCount,
    cubismCoreBytes: cubismInstalled ? safeStatFileSize(cubismCorePath) : 0,
    cubismCoreInstalled: cubismInstalled,
    modelsDirectoryBytes: sumDirectoryBytes(modelsDir),
    modelLibraryCount: countModelLibraryEntries(modelsDir)
  }
}
