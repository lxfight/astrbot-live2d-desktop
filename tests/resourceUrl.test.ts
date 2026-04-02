import { describe, expect, it } from 'vitest'

import { resolveResourceRidUrl, resolveResourceSource } from '../src/utils/resourceUrl'

describe('resourceUrl', () => {
  it('builds resource urls with path and token overrides', () => {
    expect(
      resolveResourceRidUrl('abc-123', {
        resourceBaseUrl: 'http://8.8.8.8:8090/',
        resourcePath: '/media-files/',
        resourceToken: 'secret-token',
      })
    ).toBe('http://8.8.8.8:8090/media-files/abc-123?token=secret-token')
  })

  it('prefers rid-based url reconstruction when a resource base override is configured', () => {
    expect(
      resolveResourceSource(
        {
          url: 'http://127.0.0.1:8090/resources/abc-123?token=wrong-token',
          rid: 'abc-123',
        },
        {
          resourceBaseUrl: 'http://203.0.113.10:18090',
          resourcePath: '/public-resources',
          resourceToken: 'public-token',
        }
      )
    ).toBe('http://203.0.113.10:18090/public-resources/abc-123?token=public-token')
  })

  it('keeps direct urls when no override base is configured', () => {
    expect(
      resolveResourceSource({
        url: 'https://cdn.example.com/image.png',
        rid: 'ignored-rid',
      })
    ).toBe('https://cdn.example.com/image.png')
  })

  it('rejects unsafe direct urls', () => {
    expect(
      resolveResourceSource({
        url: 'javascript:alert(1)',
      })
    ).toBeNull()
  })

  it('rejects non-data inline payloads', () => {
    expect(
      resolveResourceSource({
        inline: 'not-a-data-url',
      })
    ).toBeNull()
  })

  it('rejects rid path traversal fragments', () => {
    expect(() => resolveResourceRidUrl('../secret.txt')).toThrow('资源标识包含非法路径片段')
  })
})
