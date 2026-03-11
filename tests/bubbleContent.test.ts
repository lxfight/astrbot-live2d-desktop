import { describe, expect, it } from 'vitest'

import {
  computeBubbleAutoHideDelay,
  resolvePerformMediaSource,
  splitPerformSequenceForBubble,
} from '../src/utils/bubbleContent'

describe('bubbleContent', () => {
  it('extracts text and image items into bubble content while keeping other elements queued', () => {
    const sequence = [
      { type: 'text', content: '你好', position: 'top' },
      { type: 'motion', group: 'tap_body', index: 0 },
      { type: 'image', rid: 'img_123' },
      { type: 'tts', url: 'https://cdn.example.com/voice.mp3' },
    ]

    const result = splitPerformSequenceForBubble(sequence, {
      resourceBaseUrl: 'http://127.0.0.1:9091',
    })

    expect(result.position).toBe('top')
    expect(result.bubbleItems).toEqual([
      { type: 'text', text: '你好' },
      {
        type: 'image',
        src: 'http://127.0.0.1:9091/resources/img_123',
        alt: 'AstrBot message image',
      },
    ])
    expect(result.remainingSequence).toEqual([
      { type: 'motion', group: 'tap_body', index: 0 },
      { type: 'tts', url: 'https://cdn.example.com/voice.mp3' },
    ])
  })

  it('prefers inline or direct URLs when resolving image sources', () => {
    expect(
      resolvePerformMediaSource({
        inline: 'data:image/png;base64,abcd',
        url: 'https://cdn.example.com/ignored.png',
        rid: 'ignored',
      })
    ).toBe('data:image/png;base64,abcd')

    expect(
      resolvePerformMediaSource({
        url: 'https://cdn.example.com/image.png',
        rid: 'ignored',
      })
    ).toBe('https://cdn.example.com/image.png')
  })

  it('computes a longer hide delay for mixed text and image bubbles', () => {
    expect(computeBubbleAutoHideDelay([{ type: 'text', text: '短消息' }])).toBe(5000)

    expect(
      computeBubbleAutoHideDelay([
        { type: 'text', text: 'a'.repeat(80) },
        { type: 'image', src: 'https://cdn.example.com/image.png', alt: 'AstrBot message image' },
      ])
    ).toBe(8000)
  })
})
