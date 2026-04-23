import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import http from 'http'
import https from 'https'
import { PROTOCOL_VERSION } from '../../src/shared/metadata'
import type { BridgeLifecycleErrorCode, BridgeSessionState } from '../../src/shared/bridgeLifecycle'
import { getUserId } from '../database/schema'
import { resolveHttpUrl } from '../utils/urlNormalize'
import type {
  BasePacket,
  HandshakePayload,
  HandshakeAckPayload,
  InputMessagePayload,
  MessageContent,
  PerformShowPayload,
  STTTranscribePayload,
  STTResultPayload,
  DesktopCaptureRequestPayload,
  DesktopToolCallPayload,
} from './types'
import { OP as OPS, ERROR_CODE } from './types'
import { prepareMessageContentForTransport } from './messageContent'
import {
  getWindowList,
  getActiveWindow,
  captureScreenshot,
  getDesktopTools,
  handleToolCall,
} from '../ipc/desktop'

export interface BridgeOpenOptions {
  url: string
  token: string
  handshakeTimeoutMs: number
  onSocketOpen?: () => void
}

export interface BridgeClientDisconnectInfo {
  code: number
  reason: string
  errorCode: BridgeLifecycleErrorCode | null
  errorMessage: string | null
}

export interface BridgeClientError extends Error {
  code: BridgeLifecycleErrorCode
}

function createBridgeClientError(code: BridgeLifecycleErrorCode, message: string): BridgeClientError {
  const error = new Error(message) as BridgeClientError
  error.name = 'BridgeClientError'
  error.code = code
  return error
}

function createOpenCloseError(info: BridgeClientDisconnectInfo): BridgeClientError {
  if (info.errorCode && info.errorMessage) {
    return createBridgeClientError(info.errorCode, info.errorMessage)
  }

  return createBridgeClientError(
    'WS_UNEXPECTED_CLOSE',
    `连接在握手阶段断开: ${info.reason || info.code || 'unknown'}`,
  )
}

/**
 * L2D-Bridge WebSocket 客户端
 */
export class L2DBridgeClient extends EventEmitter {
  private ws: WebSocket | null = null
  private url = ''
  private token = ''
  private sessionId = ''
  private userId = ''
  private heartbeatTimer: NodeJS.Timeout | null = null
  private handshakeTimer: NodeJS.Timeout | null = null
  private ready = false
  private pendingOpen:
    | {
        resolve: () => void
        reject: (error: BridgeClientError) => void
      }
    | null = null
  private pendingDisconnectError: { code: BridgeLifecycleErrorCode; message: string } | null = null
  private serverConfig: { resourceBaseUrl?: string; resourcePath?: string; maxInlineBytes?: number } = {}
  private pendingRequests: Map<string, {
    resolve: (payload: any) => void
    reject: (error: Error) => void
    timer: NodeJS.Timeout
  }> = new Map()

  /**
   * 建立单次连接并等待握手完成
   */
  async open(options: BridgeOpenOptions): Promise<BridgeSessionState> {
    if (this.ws) {
      throw createBridgeClientError('CLIENT_UNAVAILABLE', '连接客户端忙碌中，请稍后重试')
    }

    const normalizedUrl = (options.url || '').trim()
    const normalizedToken = (options.token || '').trim()

    if (!normalizedToken) {
      throw createBridgeClientError('TOKEN_REQUIRED', '认证密钥不能为空，请在设置中填写后再连接')
    }

    this.url = normalizedUrl
    this.token = normalizedToken
    this.ready = false
    this.pendingDisconnectError = null
    this.resetSessionState()

    return await new Promise<BridgeSessionState>((resolve, reject) => {
      try {
        this.pendingOpen = {
          resolve: () => resolve(this.getSession()),
          reject,
        }

        this.ws = new WebSocket(normalizedUrl)

        this.ws.on('open', () => {
          console.log('[L2D] WebSocket 已连接')
          options.onSocketOpen?.()
          this.sendHandshake()
          this.startHandshakeTimeout(options.handshakeTimeoutMs)
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
          const disconnectInfo = this.handleSocketClose(code, reason.toString())
          if (this.pendingOpen) {
            this.rejectPendingOpen(createOpenCloseError(disconnectInfo))
            return
          }

          if (this.ready || disconnectInfo.errorCode || disconnectInfo.errorMessage) {
            this.emit('disconnected', disconnectInfo)
          }
        })

        this.ws.on('error', (error) => {
          console.error('[L2D] WebSocket 错误:', error)
          if (this.pendingOpen) {
            this.rejectPendingOpen(
              createBridgeClientError(
                'WS_CONNECT_FAILED',
                error instanceof Error ? error.message : String(error),
              ),
            )
          }
        })
      } catch (error) {
        this.rejectPendingOpen(
          createBridgeClientError(
            'WS_CONNECT_FAILED',
            error instanceof Error ? error.message : String(error),
          ),
        )
      }
    })
  }

  /**
   * 主动关闭连接
   */
  close(): void {
    this.stopHandshakeTimeout()
    this.stopHeartbeat()

    if (this.ws) {
      const ws = this.ws
      this.ws = null

      if (ws.readyState === WebSocket.CONNECTING) {
        ws.terminate()
      } else {
        ws.close()
      }
    }

    if (this.pendingOpen) {
      this.rejectPendingOpen(createBridgeClientError('CLIENT_UNAVAILABLE', '连接已关闭'))
    }

    this.clearPendingRequests(new Error('连接已断开'))
    this.ready = false
    this.pendingDisconnectError = null
    this.resetSessionState()
  }

  private handleSocketClose(code: number, reason: string): BridgeClientDisconnectInfo {
    console.log(`[L2D] WebSocket 已断开: ${code} - ${reason}`)
    this.stopHandshakeTimeout()
    this.stopHeartbeat()

    const wasReady = this.ready
    const disconnectInfo: BridgeClientDisconnectInfo = {
      code,
      reason,
      errorCode: this.pendingDisconnectError?.code || null,
      errorMessage: this.pendingDisconnectError?.message || null,
    }

    this.pendingDisconnectError = null
    this.clearPendingRequests(new Error('连接已断开'))
    this.ready = false
    this.ws = null
    this.resetSessionState()

    if (!wasReady && !this.pendingOpen) {
      return disconnectInfo
    }

    return disconnectInfo
  }

  private resetSessionState(): void {
    this.sessionId = ''
    this.userId = ''
    this.serverConfig = {}
  }

  private clearPendingRequests(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }

  private startHandshakeTimeout(timeoutMs: number): void {
    this.stopHandshakeTimeout()
    this.handshakeTimer = setTimeout(() => {
      this.rejectPendingOpen(
        createBridgeClientError('HANDSHAKE_TIMEOUT', '连接已建立但握手未完成，请检查服务端状态与认证配置'),
      )
      if (this.ws) {
        this.ws.close(1008, '握手超时')
      }
    }, timeoutMs)
  }

  private stopHandshakeTimeout(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer)
      this.handshakeTimer = null
    }
  }

  private rejectPendingOpen(error: BridgeClientError): void {
    if (!this.pendingOpen) {
      return
    }

    const pendingOpen = this.pendingOpen
    this.pendingOpen = null
    this.stopHandshakeTimeout()
    pendingOpen.reject(error)
  }

  private resolvePendingOpen(): void {
    if (!this.pendingOpen) {
      return
    }

    const pendingOpen = this.pendingOpen
    this.pendingOpen = null
    this.stopHandshakeTimeout()
    pendingOpen.resolve()
  }

  private markProtocolDisconnect(code: BridgeLifecycleErrorCode, message: string): void {
    this.pendingDisconnectError = { code, message }
    if (this.ws) {
      this.ws.close(1008, message)
    }
  }

  private rejectOpenWithProtocolError(code: BridgeLifecycleErrorCode, message: string): void {
    this.rejectPendingOpen(createBridgeClientError(code, message))
    this.markProtocolDisconnect(code, message)
  }

  /**
   * 发送握手请求
   */
  private sendHandshake(): void {
    const userId = getUserId()

    const payload: HandshakePayload = {
      version: PROTOCOL_VERSION,
      clientId: userId,
      token: this.token,
      tools: getDesktopTools(),
    }

    this.send({
      op: OPS.SYS_HANDSHAKE,
      id: uuidv4(),
      ts: Date.now(),
      payload,
    })
  }

  /**
   * 处理接收到的数据包
   */
  private handlePacket(packet: BasePacket): void {
    if (packet.op !== OPS.SYS_PONG) {
      const safePayload = this.sanitizeForLog(packet.payload)
      console.log('[L2D] 收到数据包:', packet.op, safePayload)
    }

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
        this.handleSystemErrorPacket(packet)
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
        break

      default:
        console.warn('[L2D] 未知操作码:', packet.op)
    }
  }

  private handleSystemErrorPacket(packet: BasePacket): void {
    const errorCode = packet.error?.code
    const errorMessage = packet.error?.message || '服务端返回协议错误'

    if (errorCode === ERROR_CODE.AUTH_FAILED) {
      if (this.pendingOpen) {
        this.rejectOpenWithProtocolError('AUTH_FAILED', errorMessage)
      } else {
        this.markProtocolDisconnect('AUTH_FAILED', errorMessage)
      }
      return
    }

    if (errorCode === ERROR_CODE.VERSION_MISMATCH) {
      if (this.pendingOpen) {
        this.rejectOpenWithProtocolError('VERSION_MISMATCH', errorMessage)
      } else {
        this.markProtocolDisconnect('VERSION_MISMATCH', errorMessage)
      }
      return
    }

    console.error('[L2D] 收到系统错误:', packet.error)
  }

  /**
   * 处理握手确认
   */
  private handleHandshakeAck(payload: HandshakeAckPayload): void {
    const session = (payload as any).session
    this.sessionId = session?.sessionId || payload.sessionId || ''
    this.userId = session?.userId || payload.userId || ''

    console.log('[L2D] 握手成功:', {
      sessionId: this.sessionId,
      userId: this.userId,
      capabilities: payload.capabilities,
    })

    this.serverConfig = {
      resourceBaseUrl: payload.config?.resourceBaseUrl,
      resourcePath: payload.config?.resourcePath,
      maxInlineBytes: payload.config?.maxInlineBytes,
    }

    this.ready = true
    this.startHeartbeat()
    this.resolvePendingOpen()
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
        ts: Date.now(),
      })
    }, 30000)
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
   * 发送消息
   */
  async sendMessage(payload: InputMessagePayload): Promise<MessageContent[]> {
    const preparedContent = await this.prepareMessageContent(payload.content)
    this.send({
      op: OPS.INPUT_MESSAGE,
      id: uuidv4(),
      ts: Date.now(),
      payload: {
        ...payload,
        content: preparedContent,
      },
    })

    return preparedContent
  }

  /**
   * 发送触摸事件
   */
  sendTouch(x: number, y: number, action: string): void {
    this.send({
      op: OPS.INPUT_TOUCH,
      id: uuidv4(),
      ts: Date.now(),
      payload: { x, y, action },
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
      payload,
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
      payload,
    })
  }

  /**
   * 脱敏处理用于日志输出
   */
  private sanitizeForLog(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload
    const sensitiveKeys = ['token', 'password', 'secret', 'apiKey', 'accessKey']
    const MAX_STRING_LEN = 200
    const MAX_PREVIEW_ITEMS = 3
    const MAX_DEPTH = 4

    const sanitize = (obj: any, seen: WeakSet<object>, depth: number): any => {
      if (!obj || typeof obj !== 'object') {
        if (typeof obj === 'string' && obj.length > MAX_STRING_LEN) {
          return obj.slice(0, MAX_STRING_LEN) + '...'
        }
        return obj
      }

      if (seen.has(obj)) {
        return '[Circular]'
      }

      if (depth >= MAX_DEPTH) {
        if (Array.isArray(obj)) {
          return `[Array:${obj.length}]`
        }
        return '[Object]'
      }

      seen.add(obj)
      if (Array.isArray(obj)) {
        const preview = obj
          .slice(0, MAX_PREVIEW_ITEMS)
          .map(item => sanitize(item, seen, depth + 1))
        const result = {
          __type: 'array',
          length: obj.length,
          preview,
        }
        seen.delete(obj)
        return result
      }

      const result: Record<string, any> = {}
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          result[key] = '***'
        } else {
          result[key] = sanitize(value, seen, depth + 1)
        }
      }
      seen.delete(obj)
      return result
    }

    return sanitize(payload, new WeakSet<object>(), 0)
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
  isReady(): boolean {
    return this.ready && this.ws?.readyState === WebSocket.OPEN && !!this.sessionId
  }

  /**
   * 获取会话信息
   */
  getSession(): BridgeSessionState {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      config: { ...this.serverConfig },
    }
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

  private async prepareMessageContent(content: MessageContent[]): Promise<MessageContent[]> {
    return await prepareMessageContentForTransport(content, {
      maxInlineBytes: this.serverConfig.maxInlineBytes,
      uploadInlineResource: this.serverConfig.resourceBaseUrl
        ? (buffer, mime) => this.uploadResource(buffer, mime)
        : undefined,
    })
  }

  private resolveHttpResourceUrl(rawUrl: string): string {
    return resolveHttpUrl(rawUrl, this.url)
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

      const resolvedUploadUrl = this.resolveHttpResourceUrl(uploadUrl)
      const headers: Record<string, string> = { 'Content-Type': mime }
      const authHeaders = result?.upload?.headers
      if (authHeaders) Object.assign(headers, authHeaders)

      const status = await this.httpPut(resolvedUploadUrl, buf, headers)
      if (status >= 200 && status < 300) {
        const resourceUrl = result?.resource?.url || uploadUrl
        return this.resolveHttpResourceUrl(resourceUrl)
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
      const isHttps = parsed.protocol === 'https:'
      const requestClient = isHttps ? https : http
      const options: http.RequestOptions = {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'PUT',
        headers: { ...headers, 'Content-Length': body.length.toString() },
      }
      const req = requestClient.request(options, (res) => {
        res.resume()
        resolve(res.statusCode || 500)
      })
      req.on('error', reject)
      req.write(body)
      req.end()
    })
  }
}
