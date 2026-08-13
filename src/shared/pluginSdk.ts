/**
 * 插件 SDK 契约（宿主与插件共用的单一来源）
 * pluginRuntime 注入的 HostApi 形状、插件 id 校验规则、入口签名。
 * SDK 包（packages/plugin-sdk）从本文件构建发布，改动需保持向前兼容。
 */

import type { PluginEntrypoint } from './pluginManifest'

/** 插件 id 规则：小写字母/数字开头，仅含小写字母、数字、-、_，长度 2-64 */
export const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-_]{1,63}$/

/** 宿主注入插件进程的 API 对象（权限由 manifest.permissions 决定） */
export interface HostApi {
  storage: {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
    keys(): Promise<string[]>
  }
  notifications: {
    show(title: string, body?: string): Promise<void>
  }
  fetch(url: string, init?: { timeoutMs?: number }): Promise<unknown>
  log: {
    debug(...args: unknown[]): void
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
  events: {
    /** 订阅宿主推送的事件（需 manifest.subscriptions 声明对应事件，宿主侧过滤） */
    on(kind: string, listener: (payload: unknown) => void): void
  }
  tray: {
    /** 托盘菜单项点击（需 manifest.trayMenu 声明对应项，宿主侧构建菜单） */
    onClick(menuId: string, listener: () => void): void
  }
}

/**
 * 声明插件入口的辅助函数：提供类型提示与返回值透传。
 * 运行时不做事，仅用于插件源码中的类型推导。
 */
export function definePlugin(
  entry: (api: HostApi) => ReturnType<PluginEntrypoint>
): PluginEntrypoint {
  return entry as PluginEntrypoint
}
