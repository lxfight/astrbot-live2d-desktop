import { app } from 'electron'
import fs from 'fs'
import path from 'path'

function getIconFileName(): string {
  return process.platform === 'win32' ? 'icon.ico' : 'icon.png'
}

/**
 * Resolve an icon path that works in both dev and packaged builds.
 *
 * Packaged: <resources>/app.asar/resources/icon.(ico|png)
 * Dev:      <projectRoot>/resources/icon.(ico|png)
 */
export function resolveAppIconPath(): string {
  const iconFileName = getIconFileName()

  // Packaged: included in app.asar by build.files
  const packagedPath = path.join(app.getAppPath(), 'resources', iconFileName)
  if (fs.existsSync(packagedPath)) return packagedPath

  // Dev: project root
  const devPath = path.join(process.cwd(), 'resources', iconFileName)
  if (fs.existsSync(devPath)) return devPath

  // Fallback (should rarely happen)
  return packagedPath
}

