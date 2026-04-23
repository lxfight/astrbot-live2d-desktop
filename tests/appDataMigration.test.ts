import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { failingCopySources } = vi.hoisted(() => ({
  failingCopySources: new Set<string>(),
}))

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  const mockedFs = {
    ...actual,
    copyFile: async (...args: Parameters<typeof actual.copyFile>) => {
      const [sourcePath] = args
      if (failingCopySources.has(sourcePath)) {
        throw new Error('simulated copy failure')
      }

      return actual.copyFile(...args)
    },
  }

  return {
    ...mockedFs,
    default: mockedFs,
  }
})

import {
  APP_DATA_MIGRATION_MARKER_FILE,
  migrateAppDataByCopy,
} from '../electron/utils/appDataMigration'

const tempRoots: string[] = []

function createTempDir(prefix: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempRoots.push(tempDir)
  return tempDir
}

function writeFile(root: string, relativePath: string, content: string): void {
  const targetPath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, content, 'utf8')
}

function readFile(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('appDataMigration', () => {
  afterEach(() => {
    failingCopySources.clear()

    while (tempRoots.length > 0) {
      const target = tempRoots.pop()
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true })
      }
    }
  })

  it('copies missing data entries without overwriting existing target files', async () => {
    const sourceRoot = createTempDir('astrbot-migration-source-')
    const targetRoot = createTempDir('astrbot-migration-target-')

    writeFile(sourceRoot, 'history.db', 'legacy-db')
    writeFile(sourceRoot, 'models/Haru/model3.json', 'legacy-model')
    writeFile(sourceRoot, 'Local Storage/leveldb/000003.log', 'legacy-local-storage')
    writeFile(sourceRoot, 'Cache/cache.bin', 'should-not-copy')

    writeFile(targetRoot, 'history.db', 'current-db')
    writeFile(targetRoot, 'models/Haru/current.txt', 'current-model')

    const result = await migrateAppDataByCopy({ sourceRoot, targetRoot })

    expect(result.attempted).toBe(true)
    expect(result.errors).toEqual([])
    expect(readFile(targetRoot, 'history.db')).toBe('current-db')
    expect(readFile(targetRoot, 'models/Haru/model3.json')).toBe('legacy-model')
    expect(readFile(targetRoot, 'models/Haru/current.txt')).toBe('current-model')
    expect(readFile(targetRoot, 'Local Storage/leveldb/000003.log')).toBe('legacy-local-storage')
    expect(fs.existsSync(path.join(targetRoot, 'Cache', 'cache.bin'))).toBe(false)
    expect(fs.existsSync(path.join(targetRoot, APP_DATA_MIGRATION_MARKER_FILE))).toBe(true)
  })

  it('skips repeated migration once the marker file exists', async () => {
    const sourceRoot = createTempDir('astrbot-migration-source-')
    const targetRoot = createTempDir('astrbot-migration-target-')

    writeFile(sourceRoot, 'logs/app.log', 'legacy-log')

    const firstRun = await migrateAppDataByCopy({ sourceRoot, targetRoot })
    expect(firstRun.attempted).toBe(true)
    expect(readFile(targetRoot, 'logs/app.log')).toBe('legacy-log')

    writeFile(sourceRoot, 'logs/new.log', 'late-log')

    const secondRun = await migrateAppDataByCopy({ sourceRoot, targetRoot })
    expect(secondRun.attempted).toBe(false)
    expect(secondRun.skippedReason).toBe('marker-exists')
    expect(fs.existsSync(path.join(targetRoot, 'logs', 'new.log'))).toBe(false)
  })

  it('does not write the migration marker when copying fails', async () => {
    const sourceRoot = createTempDir('astrbot-migration-error-source-')
    const targetRoot = createTempDir('astrbot-migration-error-target-')

    writeFile(sourceRoot, 'logs/app.log', 'legacy-log')
    failingCopySources.add(path.join(sourceRoot, 'logs', 'app.log'))

    const result = await migrateAppDataByCopy({ sourceRoot, targetRoot })

    expect(result.attempted).toBe(true)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('logs')
    expect(result.copiedEntries).toEqual([])
    expect(fs.existsSync(path.join(targetRoot, APP_DATA_MIGRATION_MARKER_FILE))).toBe(false)
  })
})
