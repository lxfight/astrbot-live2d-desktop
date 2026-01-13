/**
 * 设置管理服务
 * 封装应用设置的读取和保存
 */

import { ElectronService } from './base'

export interface AppSettings {
  wsUrl: string
  token: string
  alwaysOnTop: boolean
  transparent: boolean
  modelScale: number
  modelX: number
  modelY: number
  windowSize: { width: number; height: number }
  windowPosition: { x: number; y: number } | null
  mousePassthrough?: boolean
  alphaThreshold?: number
  hotkeys?: Record<string, string>
}

export class SettingsService extends ElectronService {
  /**
   * 获取应用设置
   */
  async getSettings(): Promise<AppSettings> {
    return this.callIPC(
      'getSettings',
      () => window.electronAPI!.getSettings(),
      '获取设置失败'
    )
  }

  /**
   * 保存应用设置
   */
  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    return this.callIPC(
      'setSettings',
      () => window.electronAPI!.setSettings(settings),
      '保存设置失败'
    )
  }

  /**
   * 监听设置变更
   */
  onSettingsChanged(callback: (settings: AppSettings) => void): void {
    if (!this.isElectron) return
    window.electronAPI?.onSettingsChanged?.(callback)
  }

  /**
   * 设置窗口置顶
   */
  async setAlwaysOnTop(value: boolean): Promise<void> {
    return this.callIPC(
      'setAlwaysOnTop',
      () => window.electronAPI!.setAlwaysOnTop(value),
      '设置窗口置顶失败'
    )
  }

  /**
   * 设置窗口位置
   */
  async setWindowPosition(x: number, y: number): Promise<void> {
    return this.callIPC(
      'setWindowPosition',
      () => window.electronAPI!.setWindowPosition(x, y),
      '设置窗口位置失败'
    )
  }

  /**
   * 设置窗口大小
   */
  async setWindowSize(width: number, height: number): Promise<void> {
    return this.callIPC(
      'setWindowSize',
      () => window.electronAPI!.setWindowSize(width, height),
      '设置窗口大小失败'
    )
  }

  /**
   * 设置鼠标穿透
   */
  async setMousePassthrough(value: boolean): Promise<void> {
    return this.callIPC(
      'setIgnoreMouseEvents',
      () => window.electronAPI!.setIgnoreMouseEvents(value),
      '设置鼠标穿透失败'
    )
  }
}

// 导出单例
export const settingsService = new SettingsService()
