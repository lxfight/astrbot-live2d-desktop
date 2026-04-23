import fs from 'node:fs/promises'
import path from 'node:path'
import { getAppDataPathContext } from './appPaths'

export const APP_DATA_MIGRATION_MARKER_FILE = '.app-data-migration-v1.json'
export const APP_DATA_MIGRATION_ENTRIES = [
  'history.db',
  'history.db-shm',
  'history.db-wal',
  'models',
  'logs',
  'lib',
  'window-watcher-config.json',
  'Local Storage',
  'Session Storage',
  'IndexedDB',
  'WebStorage',
  'Preferences',
  'Cookies',
  'Cookies-journal',
  path.join('Network', 'Cookies'),
  path.join('Network', 'Cookies-journal'),
] as const

export interface AppDataMigrationResult {
  attempted: boolean
  sourceRoot: string
  targetRoot: string
  markerPath: string
  copiedEntries: string[]
  errors: string[]
  skippedReason?: 'not-portable' | 'same-path' | 'marker-exists' | 'source-missing'
}

interface MigrateAppDataOptions {
  sourceRoot: string
  targetRoot: string
  markerFileName?: string
  entries?: readonly string[]
}

interface MigrationMarkerPayload {
  version: 1
  sourceRoot: string
  targetRoot: string
  migratedAt: string
  copiedEntries: string[]
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function copyMissingFile(sourcePath: string, targetPath: string): Promise<boolean> {
  if (await pathExists(targetPath)) {
    return false
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.copyFile(sourcePath, targetPath)
  return true
}

async function copyMissingDirectory(
  sourcePath: string,
  targetPath: string,
  rootTarget: string,
  copiedEntries: string[],
): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true })
  const entries = await fs.readdir(sourcePath, { withFileTypes: true })

  for (const entry of entries) {
    const nextSource = path.join(sourcePath, entry.name)
    const nextTarget = path.join(targetPath, entry.name)

    if (entry.isDirectory()) {
      await copyMissingDirectory(nextSource, nextTarget, rootTarget, copiedEntries)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (await copyMissingFile(nextSource, nextTarget)) {
      copiedEntries.push(path.relative(rootTarget, nextTarget))
    }
  }
}

function createBaseResult(
  sourceRoot: string,
  targetRoot: string,
  markerPath: string,
): AppDataMigrationResult {
  return {
    attempted: false,
    sourceRoot,
    targetRoot,
    markerPath,
    copiedEntries: [],
    errors: [],
  }
}

async function writeMigrationMarker(markerPath: string, payload: MigrationMarkerPayload): Promise<void> {
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, JSON.stringify(payload, null, 2), 'utf8')
}

export async function migrateAppDataByCopy(options: MigrateAppDataOptions): Promise<AppDataMigrationResult> {
  const sourceRoot = path.resolve(options.sourceRoot)
  const targetRoot = path.resolve(options.targetRoot)
  const markerPath = path.join(targetRoot, options.markerFileName ?? APP_DATA_MIGRATION_MARKER_FILE)
  const result = createBaseResult(sourceRoot, targetRoot, markerPath)

  if (sourceRoot === targetRoot) {
    result.skippedReason = 'same-path'
    return result
  }

  if (!await pathExists(sourceRoot)) {
    result.skippedReason = 'source-missing'
    return result
  }

  if (await pathExists(markerPath)) {
    result.skippedReason = 'marker-exists'
    return result
  }

  const entries = options.entries ?? APP_DATA_MIGRATION_ENTRIES
  await fs.mkdir(targetRoot, { recursive: true })
  result.attempted = true

  for (const relativeEntry of entries) {
    const sourcePath = path.join(sourceRoot, relativeEntry)
    if (!await pathExists(sourcePath)) {
      continue
    }

    const targetPath = path.join(targetRoot, relativeEntry)

    try {
      const stat = await fs.stat(sourcePath)
      if (stat.isDirectory()) {
        await copyMissingDirectory(sourcePath, targetPath, targetRoot, result.copiedEntries)
        continue
      }

      if (stat.isFile() && await copyMissingFile(sourcePath, targetPath)) {
        result.copiedEntries.push(relativeEntry)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.errors.push(`${relativeEntry}: ${message}`)
    }
  }

  if (result.errors.length === 0) {
    await writeMigrationMarker(markerPath, {
      version: 1,
      sourceRoot,
      targetRoot,
      migratedAt: new Date().toISOString(),
      copiedEntries: result.copiedEntries,
    })
  }

  return result
}

export async function migrateLegacyAppDataIfNeeded(): Promise<AppDataMigrationResult> {
  const context = getAppDataPathContext()
  const markerPath = path.join(context.resolvedUserDataPath, APP_DATA_MIGRATION_MARKER_FILE)

  if (!context.isPortable) {
    return {
      attempted: false,
      sourceRoot: context.originalUserDataPath,
      targetRoot: context.resolvedUserDataPath,
      markerPath,
      copiedEntries: [],
      errors: [],
      skippedReason: 'not-portable',
    }
  }

  return migrateAppDataByCopy({
    sourceRoot: context.originalUserDataPath,
    targetRoot: context.resolvedUserDataPath,
    markerFileName: APP_DATA_MIGRATION_MARKER_FILE,
  })
}
