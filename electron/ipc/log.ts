import { ipcMain, shell } from 'electron'
import {
  getActiveLogLevel,
  getLogDirectoryPath,
  getLogRetentionDays,
  normalizeLogLevel,
  setActiveLogLevel,
  writeLogEntry
} from '../utils/logger'

interface RendererLogPayload {
  level?: string
  source?: string
  args?: unknown[]
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

ipcMain.on('log:renderer', (_event, payload: RendererLogPayload | undefined) => {
  const level = normalizeLogLevel(payload?.level)
  const source = sanitizeRendererSource(payload?.source)
  const args = sanitizeRendererArgs(payload?.args)
  writeLogEntry(level, source, ...args)
})

ipcMain.handle('log:getDirectory', async () => {
  return getLogDirectoryPath()
})

ipcMain.handle('log:openDirectory', async () => {
  const logDir = getLogDirectoryPath()
  const result = await shell.openPath(logDir)
  if (result) {
    return {
      success: false,
      path: logDir,
      error: result
    }
  }

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
    retentionDays: getLogRetentionDays()
  }
})
