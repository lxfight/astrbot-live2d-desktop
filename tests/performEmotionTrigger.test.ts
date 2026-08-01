import { describe, expect, it } from 'vitest'

import { resolvePerformEmotionTrigger } from '../src/windows/composables/performEmotionTrigger'

describe('resolvePerformEmotionTrigger', () => {
  it('prefers an explicit server-provided emotion intent', () => {
    const emotion = {
      emotion: 'happy',
      intensity: 0.8,
      contextTags: ['compliment']
    }

    expect(
      resolvePerformEmotionTrigger({
        interrupt: true,
        emotion,
        sequence: [{ type: 'text', content: '太好了' }]
      })
    ).toEqual({ type: 'intent', intent: emotion })
  })

  it('combines unique text and tts content for local classification', () => {
    expect(
      resolvePerformEmotionTrigger({
        interrupt: true,
        sequence: [
          { type: 'text', content: '今天真开心' },
          { type: 'tts', text: '今天真开心' },
          { type: 'tts', text: '我们成功了' }
        ]
      })
    ).toEqual({ type: 'message', message: '今天真开心\n我们成功了' })
  })

  it('does not trigger emotion for media-only performances', () => {
    expect(
      resolvePerformEmotionTrigger({
        interrupt: true,
        sequence: [{ type: 'image', url: 'https://example.com/image.png' }]
      })
    ).toBeNull()
  })
})
