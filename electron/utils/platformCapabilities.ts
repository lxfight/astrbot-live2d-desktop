type LinuxSessionType = 'x11' | 'wayland' | 'unknown' | 'n/a'

export interface PlatformCapabilities {
  platform: NodeJS.Platform
  linuxSessionType: LinuxSessionType
  mousePassthroughForward: boolean
  alwaysOnTopLevel: 'default' | 'screen-saver'
  gameMode: {
    supported: boolean
    mode: 'native-window-manager' | 'active-window-heuristic' | 'disabled'
    reason?: string
  }
}

function resolveLinuxSessionType(): LinuxSessionType {
  if (process.platform !== 'linux') return 'n/a'

  const sessionType = String(process.env.XDG_SESSION_TYPE || '').trim().toLowerCase()
  if (sessionType === 'x11' || sessionType === 'wayland') {
    return sessionType
  }

  if (process.env.WAYLAND_DISPLAY) return 'wayland'
  if (process.env.DISPLAY) return 'x11'
  return 'unknown'
}

function resolveGameModeCapability(
  platform: NodeJS.Platform,
  linuxSessionType: LinuxSessionType
): PlatformCapabilities['gameMode'] {
  if (platform === 'win32') {
    if (process.arch === 'arm64') {
      return {
        supported: false,
        mode: 'disabled',
        reason: 'Windows ARM64 暂不支持稳定的原生全屏窗口检测',
      }
    }

    return {
      supported: true,
      mode: 'native-window-manager',
    }
  }

  if (platform === 'darwin') {
    return {
      supported: true,
      mode: 'active-window-heuristic',
    }
  }

  if (platform === 'linux') {
    if (linuxSessionType === 'wayland') {
      return {
        supported: false,
        mode: 'disabled',
        reason: 'Wayland 会话下无法稳定获取活跃窗口边界',
      }
    }

    return {
      supported: true,
      mode: 'active-window-heuristic',
    }
  }

  return {
    supported: false,
    mode: 'disabled',
    reason: '当前平台未实现自动检测全屏应用',
  }
}

const linuxSessionType = resolveLinuxSessionType()
const platform = process.platform

const capabilities: PlatformCapabilities = {
  platform,
  linuxSessionType,
  mousePassthroughForward: platform !== 'linux',
  alwaysOnTopLevel: platform === 'darwin' ? 'screen-saver' : 'default',
  gameMode: resolveGameModeCapability(platform, linuxSessionType),
}

export function getPlatformCapabilities(): PlatformCapabilities {
  return capabilities
}
