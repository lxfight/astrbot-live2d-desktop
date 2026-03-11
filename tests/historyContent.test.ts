import { describe, expect, it } from 'vitest'

import {
  buildHistoryRenderableItems,
  resolveHistoryImageSource,
} from '../src/utils/historyContent'

describe('historyContent', () => {
  it('resolves rid-based images for stored history messages', () => {
    expect(resolveHistoryImageSource({ rid: 'img_001' }, 'http://127.0.0.1:9091')).toBe(
      'http://127.0.0.1:9091/resources/img_001'
    )
  })

  it('builds renderable items for normal mixed content', () => {
    const items = buildHistoryRenderableItems(
      [
        { type: 'text', text: 'hello' },
        { type: 'image', inline: 'data:image/png;base64,abcd' },
      ],
      { resourceBaseUrl: 'http://127.0.0.1:9091' }
    )

    expect(items).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'image', src: 'data:image/png;base64,abcd', alt: 'History message image' },
    ])
  })

  it('includes performance text and images when tts preview is enabled', () => {
    const items = buildHistoryRenderableItems(
      [
        { type: 'text', content: '段落一' },
        { type: 'tts', text: '旁白' },
        { type: 'image', rid: 'img_002' },
      ],
      { includeTtsText: true, resourceBaseUrl: 'http://127.0.0.1:9091' }
    )

    expect(items).toEqual([
      { type: 'text', text: '段落一' },
      { type: 'text', text: '旁白' },
      {
        type: 'image',
        src: 'http://127.0.0.1:9091/resources/img_002',
        alt: 'History message image',
      },
    ])
  })
})
