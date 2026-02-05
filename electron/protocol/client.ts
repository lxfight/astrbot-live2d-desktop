import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from 'events'
import { getUserId } from '../database/schema'
import type {
  BasePacket,
  HandshakePayload,
  HandshakeAckPayload,
  InputMessagePayload,
  PerformShowPayload,
  STTTranscribePayload,
  STTResultPayload,

} from './types'
import { OP as OPS } from './types'

/**
 * L2D-Bridge WebSocket 客户端
 */
export class L2DBridgeClient extends EventEmitter {
  private ws: WebSocket | null = null
  private url: string = ''
  private token: string = ''
  private sessionId: string = ''
  private userId: string = ''
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private isConnecting: boolean = false

  constructor() {
    super()
  }

  /**
   * 连接到服务器
   */
  async connect(url: string, token?: string): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.url = url
    this.token = token || ''
    this.isConnecting = true

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url)

        this.ws.on('open', () => {
          console.log('[L2D] WebSocket 已连接')
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.sendHandshake()
          resolve()
        })

        this.ws.on('message', (data: Buffer) => {
          try {
            const packet: BasePacket = JSON.parse(data.toString())
            this.handlePacket(packet)
          } catch (error) {
            console.error('[L2D] 解析消息失败:', error)
          }
        })

        this.ws.on('close', (code, reason) => {
          console.log(`[L2D] WebSocket 已断开: ${code} - ${reason}`)
          this.isConnecting = false
          this.stopHeartbeat()
          this.emit('disconnected', { code, reason: reason.toString() })
          this.scheduleReconnect()
        })

        this.ws.on('error', (error) => {
          console.error('[L2D] WebSocket 错误:', error)
          this.isConnecting = false
          this.emit('error', error)
          reject(error)
        })
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat()
    this.stopReconnect()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.sessionId = ''
    this.userId = ''
  }

  /**
   * 发送握手请求
   */
  private sendHandshake(): void {
    // 从数据库获取用户ID
    const userId = getUserId()

    const payload: HandshakePayload = {
      version: '1.0.0',
      clientId: userId,
      token: this.token
    }

    this.send({
      op: OPS.SYS_HANDSHAKE,
      id: uuidv4(),
      ts: Date.now(),
      payload
    })
  }

  /**
   * 处理接收到的数据包
   */
  private handlePacket(packet: BasePacket): void {
    // 过滤心跳日志，避免刷屏
    if (packet.op !== OPS.SYS_PONG) {
      console.log('[L2D] 收到数据包:', packet.op, packet.payload)
    }

    switch (packet.op) {
      case OPS.SYS_HANDSHAKE_ACK:
        this.handleHandshakeAck(packet.payload as HandshakeAckPayload)
        break

      case OPS.SYS_PONG:
        // 心跳响应，静默处理
        break

      case OPS.PERFORM_SHOW:
        this.emit('perform:show', packet.payload as PerformShowPayload)
        break

      case OPS.PERFORM_INTERRUPT:
        this.emit('perform:interrupt')
        break

      case OPS.STT_RESULT:
        this.emit('stt:result', packet.payload as STTResultPayload)
        break

      case OPS.SYS_ERROR:
        this.emit('error', packet.error)
        break

      default:
        console.warn('[L2D] 未知操作码:', packet.op)
    }
  }

  /**
   * 处理握手确认
   */
  private handleHandshakeAck(payload: HandshakeAckPayload): void {
    // 服务器返回的 sessionId 和 userId 在 session 对象中
    const session = (payload as any).session
    this.sessionId = session?.sessionId || payload.sessionId || ''
    this.userId = session?.userId || payload.userId || ''

    console.log('[L2D] 握手成功:', {
      sessionId: this.sessionId,
      userId: this.userId,
      capabilities: payload.capabilities
    })

    this.startHeartbeat()

    // 发送连接成功事件（包含完整的 payload）
    this.emit('connected', {
      sessionId: this.sessionId,
      userId: this.userId,
      capabilities: payload.capabilities,
      config: payload.config
    })
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      this.send({
        op: OPS.SYS_PING,
        id: uuidv4(),
        ts: Date.now()
      })
    }, 30000) // 30秒
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[L2D] 达到最大重连次数，停止重连')
      return
    }

    this.stopReconnect()

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    console.log(`[L2D] ${delay}ms 后尝试重连 (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect(this.url, this.token).catch((error) => {
        console.error('[L2D] 重连失败:', error)
      })
    }, delay)
  }

  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 发送消息
   */
  sendMessage(payload: InputMessagePayload): void {
    this.send({
      op: OPS.INPUT_MESSAGE,
      id: uuidv4(),
      ts: Date.now(),
      payload
    })
  }

  /**
   * 发送触摸事件
   */
  sendTouch(x: number, y: number, action: string): void {
    this.send({
      op: OPS.INPUT_TOUCH,
      id: uuidv4(),
      ts: Date.now(),
      payload: { x, y, action }
    })
  }

  /**
   * 发送状态
   */
  sendState(op: string, payload: any): void {
    this.send({
      op,
      id: uuidv4(),
      ts: Date.now(),
      payload
    })
  }

  /**
   * 发送 STT 转录请求
   */
  sendSTTTranscribe(payload: STTTranscribePayload): void {
    this.send({
      op: OPS.STT_TRANSCRIBE,
      id: uuidv4(),
      ts: Date.now(),
      payload
    })
  }

  /**
   * 发送数据包
   */
  private send(packet: BasePacket): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[L2D] WebSocket 未连接，无法发送消息')
      return
    }

    try {
      this.ws.send(JSON.stringify(packet))
    } catch (error) {
      console.error('[L2D] 发送消息失败:', error)
    }
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && !!this.sessionId
  }

  /**
   * 获取会话信息
   */
  getSession(): { sessionId: string; userId: string } {
    return {
      sessionId: this.sessionId,
      userId: this.userId
    }
  }
}
