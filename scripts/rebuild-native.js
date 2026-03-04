/**
 * Rebuild native dependencies for Electron with one retry.
 * If better-sqlite3 prebuild cache is corrupted, clear it and retry once.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const optional = process.argv.includes('--optional')
const skip = process.env.NATIVE_REBUILD_SKIP === '1'

function runInstallAppDeps() {
  const cliPath = path.join(process.cwd(), 'node_modules', 'electron-builder', 'cli.js')
  const result = spawnSync(process.execPath, [cliPath, 'install-app-deps'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  })

  if (result.error) {
    console.error('[native-rebuild] failed to execute electron-builder:', result.error.message)
  }
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  return result
}

function resolvePrebuildCacheDirs() {
  const dirs = new Set()
  const npmCacheDir = process.env.npm_config_cache

  if (npmCacheDir) {
    dirs.add(path.join(npmCacheDir, '_prebuilds'))
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    dirs.add(path.join(localAppData, 'npm-cache', '_prebuilds'))
    dirs.add(path.join(appData, 'npm-cache', '_prebuilds'))
  } else {
    dirs.add(path.join(os.homedir(), '.npm', '_prebuilds'))
  }

  return Array.from(dirs)
}

function clearBetterSqlitePrebuildCache() {
  let removed = 0
  for (const cacheDir of resolvePrebuildCacheDirs()) {
    if (!fs.existsSync(cacheDir)) continue

    const entries = fs.readdirSync(cacheDir)
    for (const entry of entries) {
      if (!entry.toLowerCase().includes('better-sqlite3')) continue

      const fullPath = path.join(cacheDir, entry)
      try {
        fs.rmSync(fullPath, { recursive: true, force: true })
        removed++
      } catch {
        // ignore best-effort cleanup
      }
    }
  }

  if (removed > 0) {
    console.warn(`[native-rebuild] cleared ${removed} cached better-sqlite3 prebuild file(s)`)
  }
}

function printFailureHint() {
  console.error('[native-rebuild] failed to rebuild native dependencies for Electron.')
  console.error('[native-rebuild] if better-sqlite3 fails on Windows, install VS Build Tools and retry:')
  console.error('[native-rebuild] 1) Install: Visual Studio 2022 Build Tools (Desktop development with C++)')
  console.error('[native-rebuild] 2) Run: pnpm run rebuild')
}

function main() {
  if (skip) {
    console.warn('[native-rebuild] skipped because NATIVE_REBUILD_SKIP=1')
    return
  }

  let result = runInstallAppDeps()
  if (result.status === 0) return

  clearBetterSqlitePrebuildCache()
  console.warn('[native-rebuild] retrying native rebuild once...')
  result = runInstallAppDeps()

  if (result.status === 0) return

  printFailureHint()
  if (optional) {
    console.warn('[native-rebuild] continuing because --optional was provided')
    return
  }

  process.exit(result.status || 1)
}

main()
