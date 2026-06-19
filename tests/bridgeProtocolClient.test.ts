import { afterEach, describe, expect, test, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, type WebSocket } from 'ws'
import { OP } from '../electron/protocol/types'

vi.mock('../electron/utils/logger', () => {
  const noop = () => {}
  return {
    createScopedLogger: () => ({
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
      timer: () => ({ done: noop, fail: noop })
    })
  }
})

vi.mock('../electron/database/schema', () => ({
  getUserId: () => 'desktop-user-1'
}))

vi.mock('../electron/ipc/desktop', () => ({
  getWindowList: vi.fn(),
  getActiveWindow: vi.fn(),
  captureScreenshot: vi.fn(),
  getDesktopTools: () => [],
  handleToolCall: vi.fn()
}))

const { L2DBridgeClient } = await import('../electron/protocol/client')

function waitForServer(server: WebSocketServer): Promise<void> {
  return new Promise(resolve => {
    if (server.address()) {
      resolve()
      return
    }
    server.once('listening', () => resolve())
  })
}

function closeServer(server: WebSocketServer): Promise<void> {
  return new Promise(resolve => {
    server.close(() => resolve())
  })
}

describe('L2DBridgeClient', () => {
  const servers: WebSocketServer[] = []

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => closeServer(server)))
  })

  test('握手完成后的服务端断开会发出 disconnected 事件', async () => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    servers.push(server)
    await waitForServer(server)

    let acceptedSocket: WebSocket | null = null
    server.on('connection', socket => {
      acceptedSocket = socket
      socket.once('message', data => {
        const packet = JSON.parse(data.toString())
        expect(packet.op).toBe(OP.SYS_HANDSHAKE)

        socket.send(
          JSON.stringify({
            op: OP.SYS_HANDSHAKE_ACK,
            id: 'handshake-ack-1',
            ts: Date.now(),
            payload: {
              session: {
                sessionId: 'session-1',
                userId: 'desktop-user-1'
              },
              capabilities: [],
              config: {
                maxMessageLength: 65536,
                supportedImageFormats: [],
                supportedAudioFormats: [],
                maxInlineBytes: 4096,
                resourceBaseUrl: ''
              }
            }
          })
        )
      })
    })

    const address = server.address() as AddressInfo
    const client = new L2DBridgeClient()
    const disconnected = new Promise(resolve => {
      client.once('disconnected', resolve)
    })

    const session = await client.open({
      url: `ws://127.0.0.1:${address.port}/astrbot/live2d`,
      token: 'token-1',
      handshakeTimeoutMs: 1000
    })

    expect(session.sessionId).toBe('session-1')
    expect(client.isReady()).toBe(true)

    acceptedSocket?.close(1001, 'server restart')

    await expect(disconnected).resolves.toMatchObject({
      code: 1001,
      reason: 'server restart',
      errorCode: null,
      errorMessage: null
    })
    expect(client.isReady()).toBe(false)
  })
})
