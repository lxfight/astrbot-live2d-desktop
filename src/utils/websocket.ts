/**
 * L2D-Bridge Protocol v1.0 WebSocket 客户端
 */

import { logger } from './logger'
import type {
  BasePacket,
  HandshakeAckMessage,
  HandshakeAckPayload,
  MessageOperation,
  ResourcePayload,
  ResourcePreparePayload,
  ResourcePrepareResponse
} from '@/types/websocket'

type EventCallback = (data: any) => void

interface PendingRequest {
  resolve: (packet: BasePacket) => void
  reject: (error: Error) => void
  timeoutId: number
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private clientId: string
  private reconnectInterval: number = 5000
  private reconnectTimer: number | null = null
  private eventCallbacks: Map<string, EventCallback[]> = new Map()
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private serverConfig: HandshakeAckPayload['config'] | null = null
  private serverCapabilities: Set<string> = new Set()
  private pingTimer: number | null = null
  private readonly pingIntervalMs: number = 15000

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
    this.clientId = this.generateId()
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  private getCurrentTimestamp(): number {
    return Date.now()
  }

  private createPacket(op: MessageOperation, payload?: any, id?: string): BasePacket {
    return {
      op,
      id: id || this.generateId(),
      ts: this.getCurrentTimestamp(),
      payload
    }
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        logger.info('WebSocket 连接已建立')
        this.sendHandshake()
        this.emit('open', null)
        this.startPing()

        // 清除重连定时器
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onclose = () => {
        logger.info('WebSocket 连接已关闭')
        this.emit('close', null)
        this.stopPing()
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        logger.error('WebSocket 错误:', error)
        this.emit('error', error)
      }

      this.ws.onmessage = (event) => {
        try {
          const packet: BasePacket = JSON.parse(event.data)
          this.handlePacket(packet)
        } catch (error) {
          logger.error('解析消息失败:', error)
        }
      }
    } catch (error) {
      logger.error('创建 WebSocket 连接失败:', error)
      this.scheduleReconnect()
    }
  }

  disconnect() {
    this.stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.pendingRequests.size > 0) {
      this.pendingRequests.forEach((pending) => {
        window.clearTimeout(pending.timeoutId)
        pending.reject(new Error('连接已断开'))
      })
      this.pendingRequests.clear()
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return

    logger.debug(`${this.reconnectInterval / 1000}秒后重新连接...`)
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.reconnectInterval)
  }

  private sendHandshake() {
    const payload = {
      version: '1.0.0',
      clientId: this.clientId,
      clientName: 'astrbot-live2d-desktop',
      token: this.token,
      capabilities: [
        'input.message',
        'input.touch',
        'input.shortcut',
        'perform.show',
        'perform.interrupt',
        'resource.prepare',
        'resource.commit',
        'resource.get',
        'resource.release',
        'state.ready',
        'state.playing',
        'state.config',
        'model.*',
        'desktop.*'
      ]
    }
    this.sendRequest('sys.handshake', payload)
      .then((packet) => {
        const ack = packet as HandshakeAckMessage
        this.serverConfig = ack.payload?.config ?? null
        this.serverCapabilities = new Set(ack.payload?.capabilities ?? [])
        logger.info('握手成功:', ack.payload)
        this.emit('ready', ack.payload)
      })
      .catch((error) => {
        logger.error('握手失败:', error)
      })
  }

  private handlePacket(packet: BasePacket) {
    logger.debug('收到消息:', packet.op)

    if (packet.op === 'sys.ping') {
      this.sendPacket('sys.pong', undefined, packet.id)
      return
    }

    const pending = this.pendingRequests.get(packet.id)
    if (pending) {
      window.clearTimeout(pending.timeoutId)
      this.pendingRequests.delete(packet.id)
      if (packet.op === 'sys.error') {
        pending.reject(new Error(packet.error?.message || '服务器错误'))
      } else {
        pending.resolve(packet)
      }
      return
    }

    if (packet.op === 'sys.error') {
      logger.error('服务器错误:', packet.error)
      return
    }
    this.emit('message', packet)
  }

  private send(packet: BasePacket) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet))
    } else {
      logger.warn('WebSocket 未连接，无法发送消息')
    }
  }

  sendPacket(op: MessageOperation, payload?: any, id?: string) {
    const packet = this.createPacket(op, payload, id)
    this.send(packet)
  }

  sendError(code: number, message: string, id?: string) {
    const packet: BasePacket = {
      op: 'sys.error',
      id: id || this.generateId(),
      ts: this.getCurrentTimestamp(),
      error: { code, message }
    }
    this.send(packet)
  }

  sendTouch(part: string, action: string, duration: number = 0) {
    const packet = this.createPacket('input.touch', {
      part,
      action,
      duration
    })
    this.send(packet)
  }

  /**
   * 发送消息（支持完整的 input.message 协议）
   */
  async sendMessage(
    content: Array<{ type: string; [key: string]: any }>,
    metadata?: any
  ) {
    const prepared = await this.prepareContent(content)
    const packet = this.createPacket('input.message', {
      content: prepared,
      metadata: metadata || {
        userId: this.clientId,
        userName: 'Live2D User',
        sessionId: this.clientId
      }
    })
    this.send(packet)
  }

  /**
   * 发送文本消息（简化版本）
   */
  async sendText(text: string) {
    const content = [{ type: 'text', text }]
    await this.sendMessage(content)
  }

  sendShortcut(key: string) {
    const packet = this.createPacket('input.shortcut', {
      key
    })
    this.send(packet)
  }

  async prepareResource(payload: ResourcePreparePayload): Promise<ResourcePrepareResponse> {
    const response = await this.sendRequest('resource.prepare', payload)
    return (response.payload || {}) as ResourcePrepareResponse
  }

  async commitResource(rid: string, size?: number) {
    await this.sendRequest('resource.commit', { rid, size })
  }

  async getResource(rid: string): Promise<ResourcePayload | null> {
    const response = await this.sendRequest('resource.get', { rid })
    return (response.payload || null) as ResourcePayload | null
  }

  async releaseResource(rid: string) {
    await this.sendRequest('resource.release', { rid })
  }

  sendStateReady(clientId?: string) {
    this.sendPacket('state.ready', { clientId })
  }

  sendStatePlaying(isPlaying: boolean) {
    this.sendPacket('state.playing', { isPlaying })
  }

  sendStateConfig(payload: { modelId?: string; screen?: { w: number; h: number } }) {
    this.sendPacket('state.config', payload)
  }

  getServerConfig() {
    return this.serverConfig
  }

  hasCapability(capability: string) {
    return this.serverCapabilities.has(capability)
  }

  private async sendRequest(op: MessageOperation, payload?: any, timeoutMs: number = 10000) {
    const packet = this.createPacket(op, payload)
    return new Promise<BasePacket>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingRequests.delete(packet.id)
        reject(new Error(`请求超时: ${op}`))
      }, timeoutMs)

      this.pendingRequests.set(packet.id, { resolve, reject, timeoutId })
      this.send(packet)
    })
  }

  private async prepareContent(content: Array<{ type: string; [key: string]: any }>) {
    const prepared: Array<{ type: string; [key: string]: any }> = []
    for (const item of content) {
      if (item?.type === 'image' || item?.type === 'voice') {
        const file: Blob | undefined = item.file || item.blob
        if (file) {
          const preparedItem = await this.prepareFileContent(item.type, file)
          prepared.push(preparedItem)
          continue
        }
      }
      prepared.push(item)
    }
    return prepared
  }

  private async prepareFileContent(type: 'image' | 'voice', file: Blob) {
    const mime = file.type || (type === 'image' ? 'image/png' : 'audio/webm')
    const resource = await this.prepareBinaryResource(
      type === 'image' ? 'image' : 'audio',
      file,
      mime
    )
    if (resource.rid) {
      return { type, rid: resource.rid }
    }
    if (resource.inline) {
      return { type, data: resource.inline }
    }
    return { type }
  }

  async prepareBinaryResource(
    kind: 'image' | 'audio' | 'video' | 'file',
    file: Blob,
    mimeOverride?: string
  ) {
    const config = this.serverConfig
    const maxInline = config?.maxInlineBytes ?? 262144
    const supportsUpload = this.hasCapability('resource.prepare')
    const fallbackMime = kind === 'image' ? 'image/png' : 'application/octet-stream'
    const mime = mimeOverride || file.type || fallbackMime

    if (supportsUpload && file.size > maxInline) {
      const payload: ResourcePreparePayload = {
        kind,
        mime,
        size: file.size
      }
      const prepareResult = await this.prepareResource(payload)
      const upload = prepareResult.upload
      if (upload?.url) {
        const headers = { ...(upload.headers || {}) }
        if (!headers['Content-Type']) {
          headers['Content-Type'] = mime
        }
        await fetch(upload.url, {
          method: upload.method || 'PUT',
          headers,
          body: file
        }).then((response) => {
          if (!response.ok) {
            throw new Error(`资源上传失败: ${response.status}`)
          }
        })
        await this.commitResource(prepareResult.rid, file.size)
        return { rid: prepareResult.rid, mime, size: file.size }
      }
    }

    const inline = await this.blobToDataUrl(file)
    return { inline, mime, size: file.size }
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsDataURL(blob)
    })
  }

  private startPing() {
    if (this.pingTimer) return
    this.pingTimer = window.setInterval(() => {
      this.sendPacket('sys.ping')
    }, this.pingIntervalMs)
  }

  private stopPing() {
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  on(event: string, callback: EventCallback) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, [])
    }
    this.eventCallbacks.get(event)!.push(callback)
  }

  off(event: string, callback: EventCallback) {
    const callbacks = this.eventCallbacks.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.eventCallbacks.get(event)
    if (callbacks) {
      callbacks.forEach((cb) => cb(data))
    }
  }
}
