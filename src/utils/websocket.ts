/**
 * L2D-Bridge Protocol v1.0 WebSocket 客户端
 */

import { logger } from './logger'

interface BasePacket {
  op: string
  id: string
  ts: number
  payload?: any
  error?: {
    code: number
    message: string
  }
}

type EventCallback = (data: any) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private clientId: string
  private reconnectInterval: number = 5000
  private reconnectTimer: number | null = null
  private eventCallbacks: Map<string, EventCallback[]> = new Map()

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

  private createPacket(op: string, payload?: any, id?: string): BasePacket {
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
        
        // 清除重连定时器
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onclose = () => {
        logger.info('WebSocket 连接已关闭')
        this.emit('close', null)
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
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
    const packet = this.createPacket('sys.handshake', {
      version: '1.0.0',
      clientId: this.clientId,
      token: this.token
    })
    this.send(packet)
  }

  private handlePacket(packet: BasePacket) {
    logger.debug('收到消息:', packet.op)

    if (packet.op === 'sys.handshake_ack') {
      logger.info('握手成功:', packet.payload)
    } else if (packet.op === 'sys.error') {
      logger.error('服务器错误:', packet.error)
    } else if (packet.op === 'sys.pong') {
      // Pong 响应
    } else {
      this.emit('message', packet)
    }
  }

  private send(packet: BasePacket) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet))
    } else {
      logger.warn('WebSocket 未连接，无法发送消息')
    }
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
  sendMessage(content: Array<{ type: string; [key: string]: any }>, metadata?: any) {
    const packet = this.createPacket('input.message', {
      content,
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
  sendText(text: string) {
    const content = [{ type: 'text', text }]
    this.sendMessage(content)
  }

  sendShortcut(key: string) {
    const packet = this.createPacket('input.shortcut', {
      key
    })
    this.send(packet)
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
