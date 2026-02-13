import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import http from 'http'
import { getUserId } from '../database/schema'
import type {
  BasePacket,
  HandshakePayload,
  HandshakeAckPayload,
  InputMessagePayload,
  PerformShowPayload,
  STTTranscribePayload,
  STTResultPayload,
  DesktopCaptureRequestPayload,
  DesktopToolCallPayload,
} from './types'
import { OP as OPS, ERROR_CODE } from './types'
import { getWindowList, getActiveWindow, captureScreenshot, getDesktopTools } from '../ipc/desktop'

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
  private maxReconnectAttempts: number = 10
  private isConnecting: boolean = false
  private shouldReconnect: boolean = true
  private serverConfig: { resourceBaseUrl?: string; maxInlineBytes?: number } = {}
  private pendingRequests: Map<string, {
    resolve: (payload: any) => void
    reject: (error: Error) => void
    timer: NodeJS.Timeout
  }> = new Map()

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

    const normalizedToken = (token || '').trim()
    if (!normalizedToken) {
      throw new Error('认证密钥不能为空，请在设置中填写后再连接')
    }

    this.url = url
    this.token = normalizedToken
    this.isConnecting = true
    this.shouldReconnect = true

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
          if (this.shouldReconnect) {
            this.scheduleReconnect()
          }
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
    this.shouldReconnect = false

    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error('连接已断开'))
    }
    this.pendingRequests.clear()

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
    const userId = getUserId()

    const payload: HandshakePayload = {
      version: '1.0.0',
      clientId: userId,
      token: this.token,
      tools: getDesktopTools(),
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

    // 拦截等待中的请求响应（按 packet.id 匹配）
    const pending = this.pendingRequests.get(packet.id)
    if (pending) {
      this.pendingRequests.delete(packet.id)
      clearTimeout(pending.timer)
      if (packet.error) {
        pending.reject(new Error(packet.error.message))
      } else {
        pending.resolve(packet.payload)
      }
      return
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
        if (
          packet.error?.code === ERROR_CODE.AUTH_FAILED
          || packet.error?.code === ERROR_CODE.VERSION_MISMATCH
        ) {
          this.shouldReconnect = false
          console.error('[L2D] 握手失败（认证或版本不匹配），已停止自动重连')

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1008, packet.error?.message || '握手失败')
          }
        }
        this.emit('error', packet.error)
        break

      case OPS.DESKTOP_WINDOW_LIST:
        this.handleDesktopWindowList(packet)
        break

      case OPS.DESKTOP_WINDOW_ACTIVE:
        this.handleDesktopWindowActive(packet)
        break

      case OPS.DESKTOP_CAPTURE_SCREENSHOT:
        this.handleDesktopCaptureScreenshot(packet)
        break

      case OPS.DESKTOP_TOOL_CALL:
        this.handleDesktopToolCall(packet)
        break

      case OPS.STATE_READY:
        // 服务器就绪通知，静默处理
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

    this.serverConfig = {
      resourceBaseUrl: payload.config?.resourceBaseUrl,
      maxInlineBytes: payload.config?.maxInlineBytes,
    }
    this.shouldReconnect = true

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
    if (!this.shouldReconnect) {
      return
    }

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

  getConnectionInfo(): { url: string; token: string } {
    return { url: this.url, token: this.token }
  }

  resetReconnect(): void {
    this.reconnectAttempts = 0
    this.stopReconnect()
  }

  /**
   * 处理窗口列表请求
   */
  private async handleDesktopWindowList(packet: BasePacket): Promise<void> {
    try {
      const result = await getWindowList()
      this.send({
        op: OPS.DESKTOP_WINDOW_LIST,
        id: packet.id,
        ts: Date.now(),
        payload: result,
      })
    } catch (error) {
      console.error('[L2D] 获取窗口列表失败:', error)
      this.send({
        op: OPS.SYS_ERROR,
        id: packet.id,
        ts: Date.now(),
        error: { code: 5000, message: `获取窗口列表失败: ${error}` },
      })
    }
  }

  /**
   * 处理活跃窗口请求
   */
  private async handleDesktopWindowActive(packet: BasePacket): Promise<void> {
    try {
      const result = await getActiveWindow()
      this.send({
        op: OPS.DESKTOP_WINDOW_ACTIVE,
        id: packet.id,
        ts: Date.now(),
        payload: result,
      })
    } catch (error) {
      console.error('[L2D] 获取活跃窗口失败:', error)
      this.send({
        op: OPS.SYS_ERROR,
        id: packet.id,
        ts: Date.now(),
        error: { code: 5000, message: `获取活跃窗口失败: ${error}` },
      })
    }
  }

  /**
   * 处理截图请求
   */
  private async handleDesktopCaptureScreenshot(packet: BasePacket): Promise<void> {
    try {
      const req = (packet.payload || {}) as DesktopCaptureRequestPayload
      const uploadFn = this.serverConfig.resourceBaseUrl
        ? (buf: Buffer, mime: string) => this.uploadResource(buf, mime)
        : undefined
      const result = await captureScreenshot(req, uploadFn, {
        maxInlineBytes: this.serverConfig.maxInlineBytes,
      })
      this.send({
        op: OPS.DESKTOP_CAPTURE_SCREENSHOT,
        id: packet.id,
        ts: Date.now(),
        payload: result,
      })
    } catch (error) {
      console.error('[L2D] 截图失败:', error)
      this.send({
        op: OPS.SYS_ERROR,
        id: packet.id,
        ts: Date.now(),
        error: { code: 5000, message: `截图失败: ${error}` },
      })
    }
  }

  /**
   * 处理通用桌面工具调用
   */
  private async handleDesktopToolCall(packet: BasePacket): Promise<void> {
    const { tool, args } = (packet.payload || {}) as DesktopToolCallPayload
    try {
      const { handleToolCall } = await import('../ipc/desktop')
      const uploadFn = this.serverConfig.resourceBaseUrl
        ? (buf: Buffer, mime: string) => this.uploadResource(buf, mime)
        : undefined
      const result = await handleToolCall(tool, args || {}, {
        uploadFn,
        maxInlineBytes: this.serverConfig.maxInlineBytes,
      })
      this.send({
        op: OPS.DESKTOP_TOOL_CALL,
        id: packet.id,
        ts: Date.now(),
        payload: { tool, result },
      })
    } catch (error: any) {
      console.error(`[L2D] 工具 ${tool} 调用失败:`, error)
      this.send({
        op: OPS.DESKTOP_TOOL_CALL,
        id: packet.id,
        ts: Date.now(),
        payload: { tool, error: error?.message || String(error) },
      })
    }
  }

  /**
   * 发送数据包并等待同 ID 响应
   */
  private sendAndWait(packet: BasePacket, timeoutMs: number = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(packet.id)
        reject(new Error('请求超时'))
      }, timeoutMs)
      this.pendingRequests.set(packet.id, { resolve, reject, timer })
      this.send(packet)
    })
  }

  /**
   * 通过资源服务器上传文件，返回资源 URL
   */
  private async uploadResource(buf: Buffer, mime: string): Promise<string | null> {
    try {
      const sha256 = createHash('sha256').update(buf).digest('hex')
      const packet: BasePacket = {
        op: OPS.RESOURCE_PREPARE,
        id: uuidv4(),
        ts: Date.now(),
        payload: { kind: 'image', mime, size: buf.length, sha256 },
      }
      const result = await this.sendAndWait(packet)
      const uploadUrl = result?.upload?.url
      if (!uploadUrl || !result?.rid) return null

      const headers: Record<string, string> = { 'Content-Type': mime }
      const authHeaders = result?.upload?.headers
      if (authHeaders) Object.assign(headers, authHeaders)

      const status = await this.httpPut(uploadUrl, buf, headers)
      if (status >= 200 && status < 300) {
        return result?.resource?.url || uploadUrl
      }
      console.error('[L2D] 资源上传 HTTP 失败:', status)
      return null
    } catch (error) {
      console.error('[L2D] 资源上传失败:', error)
      return null
    }
  }

  private httpPut(url: string, body: Buffer, headers: Record<string, string> = {}): Promise<number> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const options: http.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method: 'PUT',
        headers: { ...headers, 'Content-Length': body.length.toString() },
      }
      const req = http.request(options, (res) => {
        res.resume()
        resolve(res.statusCode || 500)
      })
      req.on('error', reject)
      req.write(body)
      req.end()
    })
  }
}
