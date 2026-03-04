import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_FILE_PREFIX = 'astrbot-live2d'
const LOG_DIRECTORY_NAME = 'logs'

let logDirPath: string | null = null
let currentDateKey = ''
let logStream: fs.WriteStream | null = null
let consolePatched = false
let processErrorHookInstalled = false

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
    return app.getPath('userData')
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

function resolveLogFilePath(date: Date): string {
  const dateKey = formatDateKey(date)
  return path.join(getLogDirectoryPath(), `${LOG_FILE_PREFIX}-${dateKey}.log`)
}

function ensureLogStream(date: Date): fs.WriteStream {
  const dateKey = formatDateKey(date)
  if (logStream && currentDateKey === dateKey) {
    return logStream
  }

  if (logStream) {
    try {
      logStream.end()
    } catch {
      // ignore stream close errors
    }
    logStream = null
  }

  const filePath = resolveLogFilePath(date)
  logStream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' })
  currentDateKey = dateKey

  logStream.on('error', (error) => {
    writeInternalError(`[logger] stream error: ${error instanceof Error ? error.message : String(error)}`)
  })

  return logStream
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

export function getLogDirectoryPath(): string {
  if (!logDirPath) {
    logDirPath = path.join(resolveUserDataPath(), LOG_DIRECTORY_NAME)
    ensureDirectory(logDirPath)
  }

  return logDirPath
}

export function writeLogEntry(level: LogLevel, source: string, ...args: unknown[]): void {
  const now = new Date()
  const line = toLogLine(level, source, args, now)

  try {
    const stream = ensureLogStream(now)
    stream.write(`${line}\n`)
  } catch (error) {
    writeInternalError(`[logger] write failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function initializeMainLogger(): void {
  if (consolePatched) {
    return
  }

  ensureDirectory(getLogDirectoryPath())
  patchConsoleMethod('debug', 'debug')
  patchConsoleMethod('log', 'info')
  patchConsoleMethod('info', 'info')
  patchConsoleMethod('warn', 'warn')
  patchConsoleMethod('error', 'error')
  consolePatched = true

  writeLogEntry('info', 'main', `日志系统已初始化，日志目录: ${getLogDirectoryPath()}`)
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
  if (!logStream) {
    return
  }

  try {
    logStream.end()
  } catch {
    // ignore stream close errors
  }

  logStream = null
  currentDateKey = ''
}
