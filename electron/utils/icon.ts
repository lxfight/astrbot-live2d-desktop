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
 * Packaged: <resources>/app.asar/resources/icon.(ico|png)
 * Dev:      <projectRoot>/resources/icon.(ico|png)
 */
export function resolveAppIconPath(): string {
  const candidates = getIconCandidates()

  // Packaged: included in app.asar by build.files
  const packagedBase = path.join(app.getAppPath(), 'resources')
  const packagedPath = resolveFirstExisting(packagedBase, candidates)
  if (packagedPath) return packagedPath

  // Dev: project root
  const devBase = path.join(process.cwd(), 'resources')
  const devPath = resolveFirstExisting(devBase, candidates)
  if (devPath) return devPath

  // Fallback (should rarely happen)
  return path.join(packagedBase, candidates[0])
}
