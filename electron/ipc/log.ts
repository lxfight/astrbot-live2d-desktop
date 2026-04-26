import { app, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {
  getActiveLogLevel,
  getLogDirectoryPath,
  getMaxLogFileBytes,
  getLogRetentionDays,
  logInfo,
  logWarn,
  normalizeLogLevel,
  setActiveLogLevel,
  writeStructuredLogEntry,
  type LogMeta,
} from '../utils/logger'

interface RendererLogPayload {
  level?: string
  source?: string
  args?: unknown[]
  context?: LogMeta
}

function sanitizeRendererSource(source: unknown): string {
  if (typeof source !== 'string') {
    return 'renderer'
  }

  const trimmed = source.trim()
  return trimmed ? trimmed.slice(0, 120) : 'renderer'
}

function sanitizeRendererArgs(args: unknown): unknown[] {
  if (!Array.isArray(args)) {
    return args === undefined ? [] : [args]
  }

  return args.slice(0, 20)
}

function clampExportDays(days: unknown): number {
  const value = typeof days === 'number' ? days : Number(days)
  if (!Number.isFinite(value)) {
    return 3
  }

  return Math.max(1, Math.min(getLogRetentionDays(), Math.round(value)))
}

function createExportTimestamp(): string {
  const now = new Date()
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ]
  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`
}

function isLogFileName(fileName: string): boolean {
  return /^astrbot-live2d-\d{4}-\d{2}-\d{2}(?:\.\d+)?\.log$/.test(fileName)
}

async function listRecentLogFiles(days: number): Promise<string[]> {
  const logDir = getLogDirectoryPath()
  const entries = await fs.promises.readdir(logDir, { withFileTypes: true })
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000
  const files: Array<{ path: string; mtimeMs: number }> = []

  for (const entry of entries) {
    if (!entry.isFile() || !isLogFileName(entry.name)) {
      continue
    }

    const filePath = path.join(logDir, entry.name)
    const stat = await fs.promises.stat(filePath)
    if (stat.mtimeMs >= threshold) {
      files.push({ path: filePath, mtimeMs: stat.mtimeMs })
    }
  }

  return files
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .map((file) => file.path)
}

ipcMain.on('log:renderer', (_event, payload: RendererLogPayload | undefined) => {
  const level = normalizeLogLevel(payload?.level)
  const source = sanitizeRendererSource(payload?.source)
  const args = sanitizeRendererArgs(payload?.args)
  writeStructuredLogEntry(level, source, 'console', {
    args,
    context: payload?.context || {},
  })
})

ipcMain.handle('log:getDirectory', async () => {
  return getLogDirectoryPath()
})

ipcMain.handle('log:openDirectory', async () => {
  const logDir = getLogDirectoryPath()
  const result = await shell.openPath(logDir)
  if (result) {
    logWarn('log', 'open_directory.failed', { path: logDir, error: result })
    return {
      success: false,
      path: logDir,
      error: result
    }
  }

  logInfo('log', 'open_directory.success', { path: logDir })
  return {
    success: true,
    path: logDir
  }
})

ipcMain.handle('log:setLevel', async (_event, level: string | undefined) => {
  const normalizedLevel = setActiveLogLevel(level)
  return {
    success: true,
    level: normalizedLevel
  }
})

ipcMain.handle('log:getConfig', async () => {
  return {
    level: getActiveLogLevel(),
    retentionDays: getLogRetentionDays(),
    maxFileBytes: getMaxLogFileBytes()
  }
})

ipcMain.handle('log:exportBundle', async (_event, days?: number) => {
  const exportDays = clampExportDays(days)
  const exportDir = path.join(app.getPath('temp'), `astrbot-live2d-logs-${createExportTimestamp()}`)

  try {
    const files = await listRecentLogFiles(exportDays)
    await fs.promises.mkdir(exportDir, { recursive: true })

    for (const filePath of files) {
      await fs.promises.copyFile(filePath, path.join(exportDir, path.basename(filePath)))
    }

    await fs.promises.writeFile(
      path.join(exportDir, 'manifest.json'),
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        days: exportDays,
        count: files.length,
        level: getActiveLogLevel(),
        retentionDays: getLogRetentionDays(),
        maxFileBytes: getMaxLogFileBytes(),
      }, null, 2),
      'utf8',
    )

    logInfo('log', 'export_bundle.success', {
      days: exportDays,
      count: files.length,
      path: exportDir,
    })

    return {
      success: true,
      path: exportDir,
      count: files.length,
    }
  } catch (error: any) {
    logWarn('log', 'export_bundle.failed', {
      days: exportDays,
      path: exportDir,
      error: error?.message || String(error),
    })

    return {
      success: false,
      path: exportDir,
      count: 0,
      error: error?.message || String(error),
    }
  }
})
