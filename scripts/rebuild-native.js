/**
 * Rebuild native dependencies for Electron with one retry.
 * If better-sqlite3 prebuild cache is corrupted, clear it and retry once.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--')
const optional = rawArgs.includes('--optional')
const skip = process.env.NATIVE_REBUILD_SKIP === '1'
const platformArg = rawArgs.find((arg) => arg.startsWith('--platform='))
const archArg = rawArgs.find((arg) => arg.startsWith('--arch='))
const onlyArg = rawArgs.find((arg) => arg.startsWith('--only='))

const targetPlatform = platformArg ? platformArg.slice('--platform='.length) : process.platform
const targetArch = archArg ? archArg.slice('--arch='.length) : process.arch
const onlyPackages = onlyArg
  ? onlyArg
      .slice('--only='.length)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  : []

function runCommand(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  })

  if (result.error) {
    console.error('[native-rebuild] command execution failed:', result.error.message)
  }
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  return result
}

function resolveWindowsPnpmCmd() {
  if (process.platform !== 'win32') return null

  const candidates = []
  if (process.env.PNPM_HOME) {
    candidates.push(path.join(process.env.PNPM_HOME, 'pnpm.cmd'))
  }
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'npm', 'pnpm.cmd'))
  }
  if (process.env.npm_execpath) {
    const npmExecDir = path.dirname(process.env.npm_execpath)
    const nodeModulesDir = path.dirname(path.dirname(path.dirname(npmExecDir)))
    candidates.push(path.join(nodeModulesDir, '.bin', 'pnpm.cmd'))
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }

  const whereResult = spawnSync('where', ['pnpm.cmd'], {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (whereResult.status === 0 && whereResult.stdout) {
    const resolved = whereResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
    if (resolved) return resolved
  }

  return null
}

function normalizeNpmExecPathForWindows(env) {
  if (process.platform !== 'win32') return env

  const currentExecPath = env.npm_execpath
  if (!currentExecPath) return env

  const lower = String(currentExecPath).toLowerCase()
  const looksLikePnpmScript = lower.includes('pnpm') && (lower.endsWith('.js') || lower.endsWith('.cjs'))
  if (!looksLikePnpmScript) return env

  const pnpmCmd = resolveWindowsPnpmCmd()
  if (!pnpmCmd) {
    console.warn('[native-rebuild] unable to locate pnpm.cmd on Windows, keeping npm_execpath unchanged')
    return env
  }

  return {
    ...env,
    npm_execpath: pnpmCmd,
  }
}

function runInstallAppDeps() {
  const cliPath = path.join(process.cwd(), 'node_modules', 'electron-builder', 'cli.js')
  const cliArgs = [cliPath, 'install-app-deps']

  if (platformArg) {
    cliArgs.push(platformArg)
  }
  if (archArg) {
    cliArgs.push(archArg)
  }

  const env = normalizeNpmExecPathForWindows({ ...process.env })
  const result = runCommand(process.execPath, cliArgs, env)
  if (result.error) {
    console.error('[native-rebuild] failed to execute electron-builder:', result.error.message)
  }

  return result
}

function resolvePnpmCliScript() {
  const execPath = process.env.npm_execpath
  if (execPath && fs.existsSync(execPath)) {
    return execPath
  }

  try {
    return require.resolve('pnpm/bin/pnpm.cjs')
  } catch {
    return null
  }
}

function resolvePackageDir(packageName) {
  try {
    const pkgJsonPath = require.resolve(`${packageName}/package.json`, { paths: [process.cwd()] })
    return path.dirname(pkgJsonPath)
  } catch {
    return null
  }
}

function getElectronVersion() {
  try {
    return require('electron/package.json').version
  } catch {
    return null
  }
}

function getElectronNativeEnv() {
  const electronVersion = getElectronVersion()
  const npmConfigArch = targetArch === 'armv7l' ? 'arm' : targetArch
  const env = {
    ...process.env,
    npm_config_arch: npmConfigArch,
    npm_config_target_arch: npmConfigArch,
    npm_config_platform: targetPlatform,
    npm_config_target_platform: targetPlatform,
    npm_config_update_binary: 'true',
    npm_config_fallback_to_build: 'true',
  }

  if (targetPlatform !== process.platform) {
    env.npm_config_force = 'true'
  }
  if (targetPlatform === 'win32' || targetPlatform === 'darwin') {
    env.npm_config_target_libc = 'unknown'
  }

  if (electronVersion) {
    env.npm_config_runtime = 'electron'
    env.npm_config_target = electronVersion
    env.npm_config_disturl = 'https://electronjs.org/headers'
  } else {
    console.warn('[native-rebuild] failed to resolve Electron version, falling back to default npm install env')
  }

  return env
}

function runSelectiveRebuild(packages) {
  const pnpmCliScript = resolvePnpmCliScript()
  if (!pnpmCliScript) {
    console.error('[native-rebuild] pnpm CLI script not found, cannot run selective rebuild')
    return { status: 1 }
  }

  const env = getElectronNativeEnv()
  for (const packageName of packages) {
    const packageDir = resolvePackageDir(packageName)
    if (!packageDir) {
      console.error(`[native-rebuild] package not found: ${packageName}`)
      return { status: 1 }
    }

    console.warn(
      `[native-rebuild] selective rebuild: ${packageName} (${targetPlatform}-${targetArch})`
    )
    const result = runCommand(process.execPath, [pnpmCliScript, '--dir', packageDir, 'run', 'install'], env)
    if (result.status !== 0) {
      return result
    }
  }

  return { status: 0 }
}

function runRebuildAttempt() {
  if (onlyPackages.length > 0) {
    return runSelectiveRebuild(onlyPackages)
  }

  // Windows arm64 commonly lacks complete native toolchains for active-win/node-window-manager.
  // Rebuild only better-sqlite3 to keep arm64 artifacts buildable.
  if (targetPlatform === 'win32' && targetArch === 'arm64') {
    return runSelectiveRebuild(['better-sqlite3'])
  }

  return runInstallAppDeps()
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

  let result = runRebuildAttempt()
  if (result.status === 0) return

  clearBetterSqlitePrebuildCache()
  console.warn('[native-rebuild] retrying native rebuild once...')
  result = runRebuildAttempt()

  if (result.status === 0) return

  printFailureHint()
  if (optional) {
    console.warn('[native-rebuild] continuing because --optional was provided')
    return
  }

  process.exit(result.status || 1)
}

main()
