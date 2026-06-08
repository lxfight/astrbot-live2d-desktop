import { describe, expect, it } from 'vitest'
import {
  buildDefaultConnectionSettingsEditable,
  normalizeConnectionSettingsEditable,
  type ConnectionSettingsEditable
} from '../src/shared/connectionSettings'
import { validateBridgeEndpointDraft } from '../src/shared/bridgeConnectionValidation'

describe('Connection settings editable', () => {
  it('builds default editable settings with empty values', () => {
    const defaults = buildDefaultConnectionSettingsEditable()
    expect(defaults.serverUrl).toBe('ws://127.0.0.1:9090/astrbot/live2d')
    expect(defaults.token).toBe('')
    expect(defaults.customResourceBaseUrl).toBe('')
    expect(defaults.customResourcePath).toBe('')
    expect(defaults.customResourceToken).toBe('')
  })

  it('normalizes editable settings filling in defaults for missing fields', () => {
    const partial = normalizeConnectionSettingsEditable({
      serverUrl: 'ws://example.com:8080'
    } as ConnectionSettingsEditable)

    expect(partial.serverUrl).toBe('ws://example.com:8080')
    expect(partial.token).toBe('')
    expect(partial.customResourceBaseUrl).toBe('')
  })

  it('normalizeConnectionSettingsEditable trims whitespace', () => {
    const normalized = normalizeConnectionSettingsEditable({
      serverUrl: '  ws://test.com  ',
      token: '  mytoken  ',
      customResourceBaseUrl: '  https://res.com  ',
      customResourcePath: '  /api  ',
      customResourceToken: '  restoken  '
    } as ConnectionSettingsEditable)

    expect(normalized.serverUrl).toBe('ws://test.com')
    expect(normalized.token).toBe('mytoken')
    expect(normalized.customResourceBaseUrl).toBe('https://res.com')
    expect(normalized.customResourcePath).toBe('/api')
    expect(normalized.customResourceToken).toBe('restoken')
  })
})

describe('Bridge endpoint validation', () => {
  it('validates a well-formed WebSocket URL with token', () => {
    const result = validateBridgeEndpointDraft({
      serverUrl: 'ws://127.0.0.1:9090/astrbot/live2d',
      token: 'my-secret-token'
    })
    expect(result.valid).toBe(true)
  })

  it('rejects empty server URL', () => {
    const result = validateBridgeEndpointDraft({
      serverUrl: '',
      token: 'token'
    })
    expect(result.valid).toBe(false)
  })

  it('rejects empty token', () => {
    const result = validateBridgeEndpointDraft({
      serverUrl: 'ws://example.com',
      token: ''
    })
    expect(result.valid).toBe(false)
  })

  it('rejects invalid URL scheme (http instead of ws/wss)', () => {
    const result = validateBridgeEndpointDraft({
      serverUrl: 'http://example.com',
      token: 'token'
    })
    expect(result.valid).toBe(false)
  })

  it('accepts wss URL', () => {
    const result = validateBridgeEndpointDraft({
      serverUrl: 'wss://secure.example.com/live2d',
      token: 'token'
    })
    expect(result.valid).toBe(true)
  })
})
