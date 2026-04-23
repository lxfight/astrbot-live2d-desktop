import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export type AppStorageMode = 'development' | 'installed' | 'portable'

export interface AppDataPathContext {
  mode: AppStorageMode
  isPortable: boolean
  portableBaseDir: string | null
  originalUserDataPath: string
  resolvedUserDataPath: string
}

export interface ResolveAppDataPathContextOptions {
  isPackaged: boolean
  originalUserDataPath: string
  exePath: string
  portableExecutableDir?: string | null
  hasPortableMarker?: boolean
}

let originalUserDataPathCache: string | null = null
let cachedContext: AppDataPathContext | null = null
let configured = false

function normalizeOptionalPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? path.resolve(trimmed) : null
}

function captureOriginalUserDataPath(): string {
  if (!originalUserDataPathCache) {
    originalUserDataPathCache = path.resolve(app.getPath('userData'))
  }

  return originalUserDataPathCache
}

export function resolveAppDataPathContext(options: ResolveAppDataPathContextOptions): AppDataPathContext {
  const originalUserDataPath = path.resolve(options.originalUserDataPath)
  const portableExecutableDir = normalizeOptionalPath(options.portableExecutableDir)
  const portableBaseDir = options.isPackaged
    ? (portableExecutableDir || (options.hasPortableMarker ? path.dirname(path.resolve(options.exePath)) : null))
    : null
  const mode: AppStorageMode = !options.isPackaged
    ? 'development'
    : (portableBaseDir ? 'portable' : 'installed')

  return {
    mode,
    isPortable: mode === 'portable',
    portableBaseDir,
    originalUserDataPath,
    resolvedUserDataPath: mode === 'portable'
      ? path.join(portableBaseDir as string, 'data')
      : originalUserDataPath,
  }
}

export function getAppDataPathContext(): AppDataPathContext {
  if (cachedContext) {
    return cachedContext
  }

  const exePath = app.getPath('exe')
  const exeDir = path.dirname(exePath)
  cachedContext = resolveAppDataPathContext({
    isPackaged: app.isPackaged,
    originalUserDataPath: captureOriginalUserDataPath(),
    exePath,
    portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR,
    hasPortableMarker: fs.existsSync(path.join(exeDir, 'portable.txt')),
  })

  return cachedContext
}

export function configureElectronDataPath(): AppDataPathContext {
  const context = getAppDataPathContext()
  if (configured || !context.isPortable) {
    return context
  }

  fs.mkdirSync(context.resolvedUserDataPath, { recursive: true })
  app.setPath('userData', context.resolvedUserDataPath)
  app.setPath('sessionData', context.resolvedUserDataPath)
  configured = true

  return context
}

export function isPortableMode(): boolean {
  return getAppDataPathContext().isPortable
}

export function getOriginalUserDataPath(): string {
  return getAppDataPathContext().originalUserDataPath
}

export function getResolvedUserDataPath(): string {
  return getAppDataPathContext().resolvedUserDataPath
}

export function getAppDataPath(): string {
  return getResolvedUserDataPath()
}
