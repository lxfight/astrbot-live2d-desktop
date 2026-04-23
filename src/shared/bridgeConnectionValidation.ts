import type { BridgeLifecycleErrorCode } from './bridgeLifecycle'

export type BridgeEndpointValidationResult =
  | {
      valid: true
    }
  | {
      valid: false
      code: BridgeLifecycleErrorCode
      message: string
    }

export function validateBridgeEndpointDraft(input: {
  serverUrl: string
  token: string
}): BridgeEndpointValidationResult {
  const serverUrl = (input.serverUrl || '').trim()
  const token = (input.token || '').trim()

  if (!serverUrl) {
    return {
      valid: false,
      code: 'INVALID_URL',
      message: '服务器地址不能为空',
    }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(serverUrl)
  } catch {
    return {
      valid: false,
      code: 'INVALID_URL',
      message: '服务器地址格式无效，请填写完整的 WebSocket 地址',
    }
  }

  if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') {
    return {
      valid: false,
      code: 'INVALID_URL',
      message: '服务器地址必须使用 ws 或 wss 协议',
    }
  }

  if (!token) {
    return {
      valid: false,
      code: 'TOKEN_REQUIRED',
      message: '认证密钥不能为空，请在设置中填写后再连接',
    }
  }

  return { valid: true }
}
