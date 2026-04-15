import { app } from 'electron'
import fs from 'fs'
import path from 'path'

function getIconCandidates(): string[] {
  if (process.platform === 'win32') {
    return ['icon.ico', 'icon.png']
  }

  if (process.platform === 'darwin') {
    return ['icon.icns', 'icon.png']
  }

  return ['icon.png', 'icon.ico']
}

function resolveFirstExisting(basePath: string, candidates: string[]): string | null {
  for (const fileName of candidates) {
    const fullPath = path.join(basePath, fileName)
    if (fs.existsSync(fullPath)) return fullPath
  }

  return null
}

/**
 * Resolve an icon path that works in both dev and packaged builds.
 *
 * Packaged: <process.resourcesPath>/icon.(ico|icns|png)
 * Dev:      <projectRoot>/resources/icon.(ico|icns|png)
 */
export function resolveAppIconPath(): string {
  const candidates = getIconCandidates()

  if (app.isPackaged) {
    const resourcesBase = process.resourcesPath
    const resourcesPath = resolveFirstExisting(resourcesBase, candidates)
    if (resourcesPath) return resourcesPath

    const legacyPackagedBase = path.join(app.getAppPath(), 'resources')
    const legacyPackagedPath = resolveFirstExisting(legacyPackagedBase, candidates)
    if (legacyPackagedPath) return legacyPackagedPath

    return path.join(resourcesBase, candidates[0])
  }

  const devBase = path.join(process.cwd(), 'resources')
  const devPath = resolveFirstExisting(devBase, candidates)
  if (devPath) return devPath

  return path.join(devBase, candidates[0])
}
