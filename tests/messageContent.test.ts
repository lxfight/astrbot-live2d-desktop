import { describe, expect, it, vi } from 'vitest'
import { decodeInlineDataUrl, prepareMessageContentForTransport } from '../electron/protocol/messageContent'

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
})
