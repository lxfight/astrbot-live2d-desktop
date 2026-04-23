import path from 'path'
import { describe, expect, it } from 'vitest'
import { resolveAppDataPathContext } from '../electron/utils/appPaths'

describe('appPaths', () => {
  it('prefers PORTABLE_EXECUTABLE_DIR over exe sibling marker for portable builds', () => {
    const context = resolveAppDataPathContext({
      isPackaged: true,
      originalUserDataPath: 'C:\\Users\\tester\\AppData\\Roaming\\astrbot-live2d-desktop',
      exePath: 'D:\\portable\\AstrBot Live2D Desktop.exe',
      portableExecutableDir: 'E:\\AstrBotPortable',
      hasPortableMarker: true,
    })

    expect(context.mode).toBe('portable')
    expect(context.portableBaseDir).toBe(path.resolve('E:\\AstrBotPortable'))
    expect(context.resolvedUserDataPath).toBe(path.join(path.resolve('E:\\AstrBotPortable'), 'data'))
  })

  it('keeps the default userData path for installed builds', () => {
    const originalUserDataPath = path.resolve('C:\\Users\\tester\\AppData\\Roaming\\astrbot-live2d-desktop')
    const context = resolveAppDataPathContext({
      isPackaged: true,
      originalUserDataPath,
      exePath: 'C:\\Program Files\\AstrBot Live2D Desktop\\AstrBot Live2D Desktop.exe',
      portableExecutableDir: '',
      hasPortableMarker: false,
    })

    expect(context.mode).toBe('installed')
    expect(context.isPortable).toBe(false)
    expect(context.resolvedUserDataPath).toBe(originalUserDataPath)
  })

  it('keeps the default userData path in development mode', () => {
    const originalUserDataPath = path.resolve('D:\\dev-user-data')
    const context = resolveAppDataPathContext({
      isPackaged: false,
      originalUserDataPath,
      exePath: 'D:\\repo\\node_modules\\electron\\dist\\electron.exe',
      portableExecutableDir: 'E:\\ShouldBeIgnored',
      hasPortableMarker: true,
    })

    expect(context.mode).toBe('development')
    expect(context.isPortable).toBe(false)
    expect(context.portableBaseDir).toBeNull()
    expect(context.resolvedUserDataPath).toBe(originalUserDataPath)
  })
})
