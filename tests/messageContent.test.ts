import { describe, expect, it, vi } from 'vitest'
import { decodeBinaryPayload, decodeInlineDataUrl, prepareMessageContentForTransport } from '../electron/protocol/messageContent'

describe('messageContent', () => {
  it('decodes valid inline data URLs', () => {
    const decoded = decodeInlineDataUrl('data:text/plain;base64,aGVsbG8=')

    expect(decoded?.mime).toBe('text/plain')
    expect(decoded?.buffer.toString('utf8')).toBe('hello')
  })

  it('keeps small inline payloads unchanged', async () => {
    const content = [{ type: 'image', inline: 'data:text/plain;base64,aGVsbG8=' }]

    await expect(prepareMessageContentForTransport(content, { maxInlineBytes: 2048 })).resolves.toEqual(content)
  })

  it('decodes binary payloads from ipc transport', () => {
    const decoded = decodeBinaryPayload({
      type: 'audio',
      mime: 'audio/webm',
      bytes: new Uint8Array([1, 2, 3])
    })

    expect(decoded?.mime).toBe('audio/webm')
    expect(Array.from(decoded?.buffer || [])).toEqual([1, 2, 3])
  })

  it('inlines small binary payloads in the main process', async () => {
    const prepared = await prepareMessageContentForTransport(
      [{ type: 'audio', bytes: new Uint8Array([104, 105]), mime: 'text/plain', name: 'tiny.txt' }],
      { maxInlineBytes: 1024 }
    )

    expect(prepared).toEqual([
      { type: 'audio', inline: 'data:text/plain;base64,aGk=', name: 'tiny.txt', bytes: undefined, mime: undefined }
    ])
  })

  it('uploads oversized inline payloads when uploader is available', async () => {
    const uploadInlineResource = vi.fn().mockResolvedValue('https://cdn.example.com/file.bin')
    const inline = `data:application/octet-stream;base64,${Buffer.alloc(4096, 1).toString('base64')}`

    const prepared = await prepareMessageContentForTransport(
      [{ type: 'image', inline, name: 'demo.bin' }],
      { maxInlineBytes: 1024, uploadInlineResource }
    )

    expect(uploadInlineResource).toHaveBeenCalledTimes(1)
    expect(prepared).toEqual([
      { type: 'image', url: 'https://cdn.example.com/file.bin', name: 'demo.bin', inline: undefined, rid: undefined }
    ])
  })

  it('rejects oversized inline payloads without upload support', async () => {
    const inline = `data:application/octet-stream;base64,${Buffer.alloc(4096, 1).toString('base64')}`

    await expect(
      prepareMessageContentForTransport([{ type: 'image', inline }], { maxInlineBytes: 1024 })
    ).rejects.toThrow('服务端未提供资源上传能力')
  })

  it('decodes ArrayBuffer binary payloads (not just Uint8Array)', () => {
    const arrayBuffer = new Uint8Array([7, 8, 9]).buffer
    const decoded = decodeBinaryPayload({
      type: 'image',
      mime: 'image/png',
      bytes: arrayBuffer
    })

    expect(decoded?.mime).toBe('image/png')
    expect(Array.from(decoded?.buffer || [])).toEqual([7, 8, 9])
  })

  it('returns null when bytes is falsy', () => {
    expect(decodeBinaryPayload({ type: 'text' })).toBeNull()
    expect(decodeBinaryPayload({ type: 'text', bytes: undefined })).toBeNull()
  })

  it('passes through items with neither inline nor bytes fields', async () => {
    const item = { type: 'text', text: 'hello' }
    const result = await prepareMessageContentForTransport([item as unknown as any])
    expect(result).toEqual([item])
  })

  it('returns null for non-data URL strings', () => {
    expect(decodeInlineDataUrl('https://example.com')).toBeNull()
    expect(decodeInlineDataUrl(123 as unknown as string)).toBeNull()
  })

  it('returns null when inline data URL has no base64 segment', () => {
    expect(decodeInlineDataUrl('data:text/plain,plain-text-here')).toBeNull()
  })

  it('uses default mime when inline data URL omits mime type', () => {
    const decoded = decodeInlineDataUrl('data:;base64,aGVsbG8=')
    expect(decoded?.mime).toBe('application/octet-stream')
  })

  it('preserves original item when preparedResource is null', async () => {
    const item = { type: 'text', text: 'no binary or inline' }
    const result = await prepareMessageContentForTransport([item])
    expect(result).toEqual([item])
  })

  it('throws when uploadInlineResource returns null', async () => {
    const inline = `data:application/octet-stream;base64,${Buffer.alloc(4096, 1).toString('base64')}`
    const uploadInlineResource = vi.fn().mockResolvedValue(null)

    await expect(
      prepareMessageContentForTransport(
        [{ type: 'image', inline, name: 'big.bin' }],
        { maxInlineBytes: 1024, uploadInlineResource }
      )
    ).rejects.toThrow('资源上传失败')
  })

  it('uses default inline limit when maxInlineBytes is invalid', async () => {
    const small = { type: 'audio', bytes: new Uint8Array([1, 2, 3]), mime: 'audio/webm' }
    const result = await prepareMessageContentForTransport([small], { maxInlineBytes: -1 })
    expect(result[0].inline).toBeDefined()
  })
})
