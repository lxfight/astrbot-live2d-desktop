import path from 'path'

export function resolveBetterSqliteNativeBindingPath(packageJsonPath: string): string {
  const packageDir = path.dirname(packageJsonPath)
  const nativeBindingPath = path.join(packageDir, 'build', 'Release', 'better_sqlite3.node')
  return nativeBindingPath.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2')
}
