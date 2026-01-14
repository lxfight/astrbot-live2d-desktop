import { defineStore } from 'pinia'
import { ref } from 'vue'
import { WebSocketClient } from '../utils/websocket'
import { logger } from '../utils/logger'
import type { PerformItem, WebSocketMessage } from '../types/websocket'

export const useConnectionStore = defineStore('connection', () => {
  const ws = ref<WebSocketClient | null>(null)
  const connected = ref(false)
  const performCallbacks = ref<Array<(sequence: PerformItem[]) => void>>([])
  const serverConfig = ref<Record<string, any> | null>(null)

  const connect = (url: string, token: string) => {
    ws.value = new WebSocketClient(url, token)

    ws.value.on('open', () => {
      connected.value = true
      logger.info('WebSocket 已连接')
    })

    ws.value.on('close', () => {
      connected.value = false
      logger.info('WebSocket 已断开')
    })

    ws.value.on('message', (packet: WebSocketMessage) => {
      // 处理表演消息（Live2D-Bridge Protocol v1.0）
      if (packet.op === 'perform.show' || packet.op === 'cmd.perform') {
        performCallbacks.value.forEach(cb => cb(packet.payload.sequence))
      }
    })

    ws.value.on('ready', (payload) => {
      serverConfig.value = payload?.config || null
    })

    ws.value.connect()
  }

  const disconnect = () => {
    if (ws.value) {
      ws.value.disconnect()
      ws.value = null
      connected.value = false
    }
  }

  const onPerform = (callback: (sequence: PerformItem[]) => void) => {
    performCallbacks.value.push(callback)
  }

  const sendTouch = (part: string, action: string) => {
    if (ws.value && connected.value) {
      ws.value.sendTouch(part, action)
    }
  }

  const sendText = async (text: string) => {
    if (ws.value && connected.value) {
      await ws.value.sendText(text)
    }
  }

  const sendMessage = async (content: Array<{ type: string; [key: string]: unknown }>) => {
    if (ws.value && connected.value) {
      await ws.value.sendMessage(content)
    }
  }

  const getResource = async (rid: string) => {
    if (ws.value && connected.value) {
      return await ws.value.getResource(rid)
    }
    return null
  }

  return {
    connected,
    serverConfig,
    connect,
    disconnect,
    onPerform,
    sendTouch,
    sendText,
    sendMessage,
    getResource
  }
})
