import { describe, expect, it } from 'vitest'
import { resolveBetterSqliteNativeBindingPath } from '../electron/database/nativeBinding'

describe('nativeBinding', () => {
  it('rewrites packaged app.asar paths to app.asar.unpacked', () => {
    expect(
      resolveBetterSqliteNativeBindingPath('C:/app/resources/app.asar/node_modules/better-sqlite3/package.json')
    ).toBe('C:\\app\\resources\\app.asar.unpacked\\node_modules\\better-sqlite3\\build\\Release\\better_sqlite3.node')
  })

  it('keeps development paths inside node_modules', () => {
    expect(
      resolveBetterSqliteNativeBindingPath('D:/repo/node_modules/better-sqlite3/package.json')
    ).toBe('D:\\repo\\node_modules\\better-sqlite3\\build\\Release\\better_sqlite3.node')
  })
})
