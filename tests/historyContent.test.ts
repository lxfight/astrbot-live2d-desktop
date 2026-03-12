import { describe, expect, it } from 'vitest'

import {
  buildHistoryRenderableItems,
  resolveHistoryMediaSource,
  resolveHistoryImageSource,
} from '../src/utils/historyContent'

describe('historyContent', () => {
  it('resolves rid-based images for stored history messages', () => {
    expect(
      resolveHistoryImageSource(
        { rid: 'img_001' },
        { resourceBaseUrl: 'http://127.0.0.1:8090', resourcePath: '/custom-media' }
      )
    ).toBe('http://127.0.0.1:8090/custom-media/img_001')
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

  it('resolves audio and video sources from rid or inline data', () => {
    expect(
      resolveHistoryMediaSource(
        { rid: 'audio_001' },
        { resourceBaseUrl: 'http://127.0.0.1:8090', resourcePath: 'custom-media' }
      )
    ).toBe('http://127.0.0.1:8090/custom-media/audio_001')

    expect(resolveHistoryMediaSource({ inline: 'data:video/mp4;base64,abcd' })).toBe(
      'data:video/mp4;base64,abcd'
    )

    expect(
      resolveHistoryMediaSource(
        { rid: 'file_001' },
        { resourceBaseUrl: 'http://127.0.0.1:8090', resourcePath: '/custom-media/' }
      )
    ).toBe('http://127.0.0.1:8090/custom-media/file_001')
  })

  it('includes performance text and images when tts preview is enabled', () => {
    const items = buildHistoryRenderableItems(
      [
        { type: 'text', content: '段落一' },
        { type: 'tts', text: '旁白' },
        { type: 'image', rid: 'img_002' },
        { type: 'audio', rid: 'audio_002', name: 'voice.wav' },
        { type: 'video', inline: 'data:video/mp4;base64,efgh', name: 'clip.mp4' },
        { type: 'file', rid: 'file_002', name: 'report.pdf' },
      ],
      {
        includeTtsText: true,
        resourceBaseUrl: 'http://127.0.0.1:8090',
        resourcePath: '/custom-media',
      }
    )

    expect(items).toEqual([
      { type: 'text', text: '段落一' },
      { type: 'text', text: '旁白' },
      {
        type: 'image',
        src: 'http://127.0.0.1:8090/custom-media/img_002',
        alt: 'History message image',
      },
      {
        type: 'audio',
        src: 'http://127.0.0.1:8090/custom-media/audio_002',
        label: 'voice.wav',
      },
      {
        type: 'video',
        src: 'data:video/mp4;base64,efgh',
        label: 'clip.mp4',
      },
      {
        type: 'file',
        src: 'http://127.0.0.1:8090/custom-media/file_002',
        label: 'report.pdf',
        name: 'report.pdf',
      },
    ])
  })
})