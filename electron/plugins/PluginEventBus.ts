/**
 * 插件事件总线
 * 宿主把业务事件（消息收发、模型加载、性能上报）广播给订阅该事件的运行中插件。
 *
 * 事件源在 ipc/ 各处理器中调用 emit；PluginHost 只负责 pushEvent 的单进程投递，
 * 订阅过滤在这里完成（manifest.subscriptions 白名单）。
 */

import type { PluginEventKind } from '../../src/shared/pluginManifest'
import type { PluginHost } from './PluginHost'

export class PluginEventBus {
  private host: PluginHost | null = null

  attach(host: PluginHost): void {
    this.host = host
  }

  detach(): void {
    this.host = null
  }

  /** 广播事件给所有订阅该事件的运行中插件 */
  emit(kind: PluginEventKind, payload: unknown): void {
    const host = this.host
    if (!host) {
      return
    }
    host.pushEventToSubscribers(kind, payload)
  }
}
