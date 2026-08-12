import { describe, expect, it } from 'vitest'
import { rgbToHexString } from '@/utils/color'
import { generateMessageId } from '@/utils/id'
import { wsToHttpProtocol, deriveHttpBaseUrlFromWsUrl } from '@/utils/urlNormalize'
import { resolveWindowKindFromHash } from '@/utils/windowKind'

describe('rgbToHexString', () => {
  it('converts rgb values to hex', () => {
    expect(rgbToHexString({ r: 255, g: 0, b: 0 })).toBe('#ff0000')
    expect(rgbToHexString({ r: 0, g: 255, b: 0 })).toBe('#00ff00')
    expect(rgbToHexString({ r: 0, g: 0, b: 255 })).toBe('#0000ff')
    expect(rgbToHexString({ r: 116, g: 165, b: 255 })).toBe('#74a5ff')
  })

  it('clamps out-of-range values', () => {
    expect(rgbToHexString({ r: 300, g: -10, b: 128 })).toBe('#ff0080')
  })

  it('pads single-digit hex values', () => {
    expect(rgbToHexString({ r: 1, g: 2, b: 3 })).toBe('#010203')
  })
})

describe('generateMessageId', () => {
  it('generates prefixed unique ids with increasing sequence', () => {
    const id1 = generateMessageId('test')
    const id2 = generateMessageId('test')

    expect(id1).toMatch(/^test_\d+_\d+_[a-z0-9]+$/)
    expect(id2).toMatch(/^test_\d+_\d+_[a-z0-9]+$/)
    expect(id1).not.toBe(id2)
  })

  it('defaults to msg prefix', () => {
    expect(generateMessageId()).toMatch(/^msg_/)
  })
})

describe('wsToHttpProtocol', () => {
  it('maps wss to https', () => {
    expect(wsToHttpProtocol('wss:')).toBe('https:')
  })

  it('maps everything else to http', () => {
    expect(wsToHttpProtocol('ws:')).toBe('http:')
    expect(wsToHttpProtocol('http:')).toBe('http:')
    expect(wsToHttpProtocol('https:')).toBe('http:')
  })
})

describe('deriveHttpBaseUrlFromWsUrl', () => {
  it('derives http base from ws url without path', () => {
    expect(deriveHttpBaseUrlFromWsUrl('ws://example.com:9090/some/path?x=1#frag')).toBe(
      'http://example.com:9090'
    )
  })

  it('maps wss to https', () => {
    expect(deriveHttpBaseUrlFromWsUrl('wss://secure.example.com/api')).toBe(
      'https://secure.example.com'
    )
  })

  it('falls back on invalid url', () => {
    expect(deriveHttpBaseUrlFromWsUrl('not-a-url')).toBe('http://127.0.0.1:9090')
  })

  it('uses custom fallback', () => {
    expect(deriveHttpBaseUrlFromWsUrl('@@bad@@', 'http://fallback:1234')).toBe(
      'http://fallback:1234'
    )
  })
})

describe('resolveWindowKindFromHash', () => {
  it('resolves settings and sub-routes', () => {
    expect(resolveWindowKindFromHash('#/settings')).toBe('settings')
    expect(resolveWindowKindFromHash('#/settings/advanced/behavior')).toBe('settings')
  })

  it('resolves history and welcome', () => {
    expect(resolveWindowKindFromHash('#/history')).toBe('history')
    expect(resolveWindowKindFromHash('#/welcome')).toBe('welcome')
  })

  it('resolves main from root or /main', () => {
    expect(resolveWindowKindFromHash('#/main')).toBe('main')
    expect(resolveWindowKindFromHash('#/')).toBe('main')
    expect(resolveWindowKindFromHash('#')).toBe('main')
    expect(resolveWindowKindFromHash('')).toBe('main')
  })

  it('resolves unknown routes', () => {
    expect(resolveWindowKindFromHash('#/something-else')).toBe('unknown')
  })

  it('handles hash without leading #', () => {
    expect(resolveWindowKindFromHash('/settings')).toBe('settings')
  })
})
