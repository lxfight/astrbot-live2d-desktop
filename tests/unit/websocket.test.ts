/**
 * WebSocket 客户端单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketClient } from '@/utils/websocket'

// Mock WebSocket
class MockWebSocket {
  onopen: any = null
  onclose: any = null
  onmessage: any = null
  onerror: any = null
  readyState = 0

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = 1
      if (this.onopen) this.onopen({})
    }, 0)
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = 3
    if (this.onclose) this.onclose({})
  }
}

global.WebSocket = MockWebSocket as any

describe('WebSocketClient', () => {
  let client: WebSocketClient

  beforeEach(() => {
    client = new WebSocketClient('ws://localhost:9090/astrbot/live2d', 'test-token')
  })

  afterEach(() => {
    client.disconnect()
  })

  it('should create WebSocket client', () => {
    expect(client).toBeDefined()
  })

  it('should emit open event on connection', (done) => {
    client.on('open', () => {
      expect(true).toBe(true)
      done()
    })
  })

  it('should send handshake on open', (done) => {
    const sendSpy = vi.spyOn(client as any, 'send')

    client.on('open', () => {
      setTimeout(() => {
        expect(sendSpy).toHaveBeenCalled()
        done()
      }, 100)
    })
  })

  it('should disconnect properly', () => {
    client.disconnect()
    expect((client as any).ws?.readyState).toBe(3)
  })
})
