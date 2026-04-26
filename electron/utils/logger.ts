import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import { getAppDataPath } from './appPaths'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogOutputLevel = 'debug' | 'info'
export type LogMeta = Record<string, unknown>

const LOG_FILE_PREFIX = 'astrbot-live2d'
const LOG_DIRECTORY_NAME = 'logs'
const LOG_RETENTION_DAYS = 14
const LOG_RETENTION_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
const LOG_FILE_NAME_PATTERN = new RegExp(`^${LOG_FILE_PREFIX}-(\\d{4}-\\d{2}-\\d{2})(?:\\.(\\d+))?\\.log$`)
const MAX_LOG_FILE_BYTES = 20 * 1024 * 1024
const MAX_LOG_STRING_LENGTH = 2000
const MAX_LOG_META_DEPTH = 5
const MAX_LOG_ARRAY_PREVIEW = 20
const MAX_LOG_OBJECT_KEYS = 80
const SENSITIVE_LOG_KEY_PATTERN = /(token|password|secret|api[-_]?key|authorization|cookie)/i

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

const OUTPUT_LEVEL_PRIORITY: Record<LogOutputLevel, number> = {
  debug: 10,
  info: 20
}

let logDirPath: string | null = null
let currentDateKey = ''
let currentLogFilePath = ''
let currentLogFileBytes = 0
let currentLogFileSequence = 0
let logStream: fs.WriteStream | null = null
let consolePatched = false
let processErrorHookInstalled = false
let activeLogLevel: LogOutputLevel = 'info'
let lastCleanupDateKey = ''

const originalConsole = {
  debug: console.debug.bind(console),
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
}

function writeInternalError(message: string): void {
  try {
    process.stderr.write(`${message}\n`)
  } catch {
    // ignore stderr failures
  }
}

function resolveUserDataPath(): string {
  try {
    return getAppDataPath()
  } catch {
    return path.join(process.cwd(), 'userData')
  }
}

function ensureDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKeyFromFileName(fileName: string): number | null {
  const match = fileName.match(LOG_FILE_NAME_PATTERN)
  if (!match) {
    return null
  }

  const parsed = new Date(`${match[1]}T00:00:00`)
  const timestamp = parsed.getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function shouldWriteLevel(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= OUTPUT_LEVEL_PRIORITY[activeLogLevel]
}

function resolveSequencedLogFilePath(dateKey: string, sequence: number): string {
  const suffix = sequence > 0 ? `.${sequence}` : ''
  return path.join(getLogDirectoryPath(), `${LOG_FILE_PREFIX}-${dateKey}${suffix}.log`)
}

function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size
  } catch {
    return 0
  }
}

function closeLogStream(): void {
  if (!logStream) {
    return
  }

  try {
    logStream.end()
  } catch {
    // 忽略关闭失败，避免日志系统影响退出流程
  }

  logStream = null
}

function ensureLogStream(date: Date, incomingBytes: number): fs.WriteStream {
  const dateKey = formatDateKey(date)
  if (
    logStream
    && currentDateKey === dateKey
    && currentLogFileBytes + incomingBytes <= MAX_LOG_FILE_BYTES
  ) {
    return logStream
  }

  const dateChanged = currentDateKey !== dateKey
  closeLogStream()

  if (dateChanged) {
    currentLogFileSequence = 0
  } else if (currentLogFileBytes + incomingBytes > MAX_LOG_FILE_BYTES) {
    currentLogFileSequence += 1
  }

  let filePath = resolveSequencedLogFilePath(dateKey, currentLogFileSequence)
  let fileSize = getFileSize(filePath)

  while (fileSize > 0 && fileSize + incomingBytes > MAX_LOG_FILE_BYTES) {
    currentLogFileSequence += 1
    filePath = resolveSequencedLogFilePath(dateKey, currentLogFileSequence)
    fileSize = getFileSize(filePath)
  }

  if (currentLogFilePath && currentLogFilePath !== filePath && !dateChanged) {
    writeInternalError(`[logger] rotated log file: ${path.basename(filePath)}`)
  }

  logStream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' })
  currentDateKey = dateKey
  currentLogFilePath = filePath
  currentLogFileBytes = fileSize

  logStream.on('error', (error) => {
    writeInternalError(`[logger] stream error: ${error instanceof Error ? error.message : String(error)}`)
  })

  return logStream
}

function truncateString(value: string, maxLength = MAX_LOG_STRING_LENGTH): string {
  if (value.startsWith('data:')) {
    const separatorIndex = value.indexOf(',')
    const header = separatorIndex >= 0 ? value.slice(0, separatorIndex + 1) : value.slice(0, 120)
    return `${header}<省略 ${Math.max(0, value.length - header.length)} 字符>`
  }

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...(总长 ${value.length} 字符)`
}

function sanitizeErrorForLog(error: unknown): LogMeta {
  if (error instanceof Error) {
    const code = typeof (error as NodeJS.ErrnoException).code === 'string'
      ? (error as NodeJS.ErrnoException).code
      : undefined
    return {
      name: error.name,
      message: truncateString(error.message),
      stack: error.stack ? truncateString(error.stack, 6000) : undefined,
      code,
    }
  }

  if (error && typeof error === 'object') {
    const raw = error as { name?: unknown; message?: unknown; stack?: unknown; code?: unknown }
    if (typeof raw.message === 'string' || typeof raw.stack === 'string') {
      return {
        name: typeof raw.name === 'string' ? raw.name : 'UnknownError',
        message: typeof raw.message === 'string' ? truncateString(raw.message) : String(error),
        stack: typeof raw.stack === 'string' ? truncateString(raw.stack, 6000) : undefined,
        code: typeof raw.code === 'string' || typeof raw.code === 'number' ? raw.code : undefined,
      }
    }
  }

  return {
    message: truncateString(String(error)),
  }
}

export function sanitizeLogValue(value: unknown, seen: WeakSet<object> = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === 'string') {
    return truncateString(value)
  }

  if (
    typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
    || value === undefined
  ) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (typeof value === 'function') {
    return `[Function:${value.name || 'anonymous'}]`
  }

  if (typeof value === 'symbol') {
    return value.toString()
  }

  if (value instanceof Error) {
    return sanitizeErrorForLog(value)
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
  }

  if (Buffer.isBuffer(value)) {
    return {
      __type: 'buffer',
      length: value.length,
    }
  }

  if (!value || typeof value !== 'object') {
    return String(value)
  }

  if (seen.has(value)) {
    return '[Circular]'
  }

  if (depth >= MAX_LOG_META_DEPTH) {
    return Array.isArray(value) ? `[Array:${value.length}]` : '[Object]'
  }

  seen.add(value)

  if (Array.isArray(value)) {
    const preview = value
      .slice(0, MAX_LOG_ARRAY_PREVIEW)
      .map((item) => sanitizeLogValue(item, seen, depth + 1))
    seen.delete(value)
    return {
      __type: 'array',
      length: value.length,
      preview,
    }
  }

  const result: Record<string, unknown> = {}
  const entries = Object.entries(value as Record<string, unknown>)
  for (const [key, entry] of entries.slice(0, MAX_LOG_OBJECT_KEYS)) {
    result[key] = SENSITIVE_LOG_KEY_PATTERN.test(key)
      ? '***'
      : sanitizeLogValue(entry, seen, depth + 1)
  }

  if (entries.length > MAX_LOG_OBJECT_KEYS) {
    result.__truncatedKeys = entries.length - MAX_LOG_OBJECT_KEYS
  }

  seen.delete(value)
  return result
}

function formatStructuredMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) {
    return ''
  }

  try {
    return ` meta=${JSON.stringify(sanitizeLogValue(meta))}`
  } catch {
    return ` meta=${stringifyArg(sanitizeLogValue(meta))}`
  }
}

function normalizeLogScope(scope: string): string {
  const normalized = String(scope || 'main').trim().replace(/\s+/g, ':')
  return normalized ? normalized.slice(0, 120) : 'main'
}

function normalizeLogEvent(event: string): string {
  const normalized = String(event || 'event').trim()
  return normalized ? normalized.slice(0, 160) : 'event'
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg
  }

  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`
  }

  try {
    return util.inspect(arg, {
      depth: 6,
      breakLength: 140,
      compact: true,
      maxArrayLength: 100,
      maxStringLength: 10000
    })
  } catch {
    try {
      return JSON.stringify(arg)
    } catch {
      return String(arg)
    }
  }
}

function toLogLine(level: LogLevel, source: string, args: unknown[], timestamp: Date): string {
  const time = timestamp.toISOString()
  const pid = process.pid
  const content = args.map((item) => stringifyArg(item)).join(' ')
  return `[${time}] [${source}] [${level.toUpperCase()}] [pid:${pid}] ${content}`
}

function patchConsoleMethod(method: 'debug' | 'log' | 'info' | 'warn' | 'error', level: LogLevel): void {
  const rawMethod = originalConsole[method]
  ;(console as any)[method] = (...args: unknown[]) => {
    writeLogEntry(level, 'main', ...args)
    rawMethod(...args as any[])
  }
}

export function normalizeLogLevel(level: string | undefined | null): LogLevel {
  switch ((level || '').toLowerCase()) {
    case 'debug':
      return 'debug'
    case 'warn':
      return 'warn'
    case 'error':
      return 'error'
    case 'info':
    default:
      return 'info'
  }
}

export function normalizeLogOutputLevel(level: string | undefined | null): LogOutputLevel {
  return (level || '').toLowerCase() === 'debug' ? 'debug' : 'info'
}

export function getLogRetentionDays(): number {
  return LOG_RETENTION_DAYS
}

export function getMaxLogFileBytes(): number {
  return MAX_LOG_FILE_BYTES
}

export function getActiveLogLevel(): LogOutputLevel {
  return activeLogLevel
}

export function setActiveLogLevel(level: string | undefined | null): LogOutputLevel {
  const normalizedLevel = normalizeLogOutputLevel(level)
  const changed = activeLogLevel !== normalizedLevel
  activeLogLevel = normalizedLevel

  if (changed) {
    writeLogEntry('info', 'main', `日志级别已切换为: ${normalizedLevel}`)
  }

  return activeLogLevel
}

function cleanupExpiredLogs(now: Date = new Date()): void {
  const cleanupDateKey = formatDateKey(now)
  if (lastCleanupDateKey === cleanupDateKey) {
    return
  }

  lastCleanupDateKey = cleanupDateKey
  const threshold = now.getTime() - LOG_RETENTION_MS
  const logDirectory = getLogDirectoryPath()

  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(logDirectory, { withFileTypes: true })
  } catch (error) {
    writeInternalError(`[logger] failed to read log directory for cleanup: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  let removedCount = 0

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const fileName = entry.name
    if (!LOG_FILE_NAME_PATTERN.test(fileName)) {
      continue
    }

    const filePath = path.join(logDirectory, fileName)
    let shouldDelete = false

    try {
      const stat = fs.statSync(filePath)
      shouldDelete = stat.mtimeMs < threshold
    } catch {
      const fallbackTimestamp = parseDateKeyFromFileName(fileName)
      if (fallbackTimestamp !== null) {
        shouldDelete = fallbackTimestamp < threshold
      }
    }

    if (!shouldDelete) {
      continue
    }

    try {
      fs.unlinkSync(filePath)
      removedCount += 1
    } catch (error) {
      writeInternalError(`[logger] failed to delete expired log file (${fileName}): ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (removedCount > 0) {
    writeInternalError(`[logger] cleaned up ${removedCount} expired log file(s), retention=${LOG_RETENTION_DAYS}d`)
  }
}

export function getLogDirectoryPath(): string {
  if (!logDirPath) {
    logDirPath = path.join(resolveUserDataPath(), LOG_DIRECTORY_NAME)
    ensureDirectory(logDirPath)
  }

  return logDirPath
}

export function writeLogEntry(level: LogLevel, source: string, ...args: unknown[]): void {
  if (!shouldWriteLevel(level)) {
    return
  }

  const now = new Date()
  const line = toLogLine(level, source, args, now)
  const lineBytes = Buffer.byteLength(`${line}\n`, 'utf8')

  try {
    cleanupExpiredLogs(now)
    const stream = ensureLogStream(now, lineBytes)
    stream.write(`${line}\n`)
    currentLogFileBytes += lineBytes
  } catch (error) {
    writeInternalError(`[logger] write failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function writeStructuredLogEntry(level: LogLevel, scope: string, event: string, meta?: LogMeta): void {
  writeLogEntry(
    level,
    normalizeLogScope(scope),
    `${normalizeLogEvent(event)}${formatStructuredMeta(meta)}`
  )
}

export function logDebug(scope: string, event: string, meta?: LogMeta): void {
  writeStructuredLogEntry('debug', scope, event, meta)
}

export function logInfo(scope: string, event: string, meta?: LogMeta): void {
  writeStructuredLogEntry('info', scope, event, meta)
}

export function logWarn(scope: string, event: string, meta?: LogMeta): void {
  writeStructuredLogEntry('warn', scope, event, meta)
}

export function logError(scope: string, event: string, error?: unknown, meta?: LogMeta): void {
  writeStructuredLogEntry('error', scope, event, {
    ...meta,
    error: error === undefined ? undefined : sanitizeErrorForLog(error),
  })
}

export function createLogTimer(scope: string, event: string, meta?: LogMeta) {
  const startedAt = Date.now()
  logDebug(scope, `${event}.start`, meta)

  return {
    done(extraMeta?: LogMeta): void {
      logDebug(scope, `${event}.success`, {
        ...meta,
        ...extraMeta,
        durationMs: Date.now() - startedAt,
      })
    },
    fail(error: unknown, extraMeta?: LogMeta): void {
      logError(scope, `${event}.failed`, error, {
        ...meta,
        ...extraMeta,
        durationMs: Date.now() - startedAt,
      })
    },
  }
}

export function createScopedLogger(scope: string) {
  return {
    debug: (event: string, meta?: LogMeta) => logDebug(scope, event, meta),
    info: (event: string, meta?: LogMeta) => logInfo(scope, event, meta),
    warn: (event: string, meta?: LogMeta) => logWarn(scope, event, meta),
    error: (event: string, error?: unknown, meta?: LogMeta) => logError(scope, event, error, meta),
    timer: (event: string, meta?: LogMeta) => createLogTimer(scope, event, meta),
  }
}

export function initializeMainLogger(): void {
  if (consolePatched) {
    return
  }

  ensureDirectory(getLogDirectoryPath())
  cleanupExpiredLogs()
  patchConsoleMethod('debug', 'debug')
  patchConsoleMethod('log', 'info')
  patchConsoleMethod('info', 'info')
  patchConsoleMethod('warn', 'warn')
  patchConsoleMethod('error', 'error')
  consolePatched = true

  writeLogEntry(
    'info',
    'main',
    `日志系统已初始化，日志目录: ${getLogDirectoryPath()}，级别: ${activeLogLevel}，保留天数: ${LOG_RETENTION_DAYS}`
  )
}

export function installMainProcessErrorHandlers(): void {
  if (processErrorHookInstalled) {
    return
  }

  processErrorHookInstalled = true

  process.on('uncaughtException', (error) => {
    writeLogEntry('error', 'main', '捕获未处理异常:', error)
  })

  process.on('unhandledRejection', (reason) => {
    writeLogEntry('error', 'main', '捕获未处理 Promise 拒绝:', reason)
  })
}

export function shutdownMainLogger(): void {
  if (logStream) {
    closeLogStream()
  }

  logStream = null
  currentDateKey = ''
  currentLogFilePath = ''
  currentLogFileBytes = 0
  currentLogFileSequence = 0
  lastCleanupDateKey = ''
}
