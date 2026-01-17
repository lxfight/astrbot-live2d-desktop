import { defineStore } from 'pinia'
import { ref } from 'vue'
import { WebSocketClient } from '../utils/websocket'
import { logger } from '../utils/logger'
import type { BasePacket, MessageOperation, PerformItem } from '../types/websocket'

export const useConnectionStore = defineStore('connection', () => {
  const ws = ref<WebSocketClient | null>(null)
  const connected = ref(false)
  const performCallbacks = ref<Array<(sequence: PerformItem[], interrupt?: boolean) => void>>([])
  const interruptCallbacks = ref<Array<() => void>>([])
  const commandCallbacks = ref<Array<(packet: BasePacket) => void>>([])
  const stateCallbacks = ref<Array<(packet: BasePacket) => void>>([])
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

    ws.value.on('message', (packet: BasePacket) => {
      // 处理表演消息（Live2D-Bridge Protocol v1.0）
      if (packet.op === 'perform.show' || packet.op === 'cmd.perform') {
        const payload = (packet as any)?.payload || {}
        const interrupt = payload?.interrupt
        const sequence = payload?.sequence || []
        performCallbacks.value.forEach(cb => cb(sequence, interrupt))
        return
      }
      if (packet.op === 'perform.interrupt') {
        interruptCallbacks.value.forEach(cb => cb())
        return
      }
      if (packet.op.startsWith('model.') || packet.op.startsWith('desktop.')) {
        commandCallbacks.value.forEach(cb => cb(packet))
        return
      }
      if (packet.op.startsWith('state.')) {
        stateCallbacks.value.forEach(cb => cb(packet))
        return
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

  const onPerform = (callback: (sequence: PerformItem[], interrupt?: boolean) => void) => {
    performCallbacks.value.push(callback)
  }

  const onPerformInterrupt = (callback: () => void) => {
    interruptCallbacks.value.push(callback)
  }

  const onCommand = (callback: (packet: BasePacket) => void) => {
    commandCallbacks.value.push(callback)
  }

  const onState = (callback: (packet: BasePacket) => void) => {
    stateCallbacks.value.push(callback)
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

  const releaseResource = async (rid: string) => {
    if (ws.value && connected.value) {
      await ws.value.releaseResource(rid)
    }
  }

  const sendPacket = (op: MessageOperation, payload?: any, id?: string) => {
    if (ws.value && connected.value) {
      ws.value.sendPacket(op, payload, id)
    }
  }

  const sendError = (id: string, code: number, message: string) => {
    if (ws.value && connected.value) {
      ws.value.sendError(code, message, id)
    }
  }

  const sendStatePlaying = (isPlaying: boolean) => {
    if (ws.value && connected.value) {
      ws.value.sendStatePlaying(isPlaying)
    }
  }

  const sendStateConfig = (payload: { modelId?: string; screen?: { w: number; h: number } }) => {
    if (ws.value && connected.value) {
      ws.value.sendStateConfig(payload)
    }
  }

  const prepareBinaryResource = async (
    kind: 'image' | 'audio' | 'video' | 'file',
    file: Blob,
    mimeOverride?: string
  ) => {
    if (ws.value && connected.value) {
      return await ws.value.prepareBinaryResource(kind, file, mimeOverride)
    }
    return null
  }

  const hasCapability = (capability: string) => {
    if (ws.value && connected.value) {
      return ws.value.hasCapability(capability)
    }
    return false
  }

  return {
    connected,
    serverConfig,
    connect,
    disconnect,
    onPerform,
    onPerformInterrupt,
    onCommand,
    onState,
    sendTouch,
    sendText,
    sendMessage,
    getResource,
    releaseResource,
    sendPacket,
    sendError,
    sendStatePlaying,
    sendStateConfig,
    prepareBinaryResource,
    hasCapability
  }
})
