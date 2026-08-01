import { describe, expect, it } from 'vitest'

import { sanitizeForLog } from '../electron/protocol/logSanitize'
import { OP } from '../electron/protocol/types'
import { summarizePerformPayloadForLog } from '../src/windows/composables/performElementSummary'

const sourceMessage = '很长的情绪来源'.repeat(40)
const payload = {
  interrupt: false,
  emotion: {
    emotion: 'happy',
    variant: 'delighted',
    naturalVAD: { valence: 0.8, arousal: 0.55, dominance: 0.4 },
    intensity: 0.82,
    contextTags: ['greeting'],
    sourceMessage
  },
  sequence: []
}

describe('perform emotion log summaries', () => {
  it('keeps a bounded renderer summary for an emotion-only performance', () => {
    const summary = summarizePerformPayloadForLog(payload)

    expect(summary.sequenceLength).toBe(0)
    expect(summary.emotion).toMatchObject({
      emotion: 'happy',
      variant: 'delighted',
      intensity: 0.82,
      contextTags: ['greeting']
    })
    expect((summary.emotion as { sourceMessage: string }).sourceMessage.length).toBeLessThan(
      sourceMessage.length
    )
  })

  it('keeps a bounded protocol summary for an emotion-only performance', () => {
    const summary = sanitizeForLog(payload, OP.PERFORM_SHOW)

    expect(summary.sequenceLength).toBe(0)
    expect(summary.emotion.naturalVAD).toEqual(payload.emotion.naturalVAD)
    expect(summary.emotion.sourceMessage).toHaveLength(200)
  })
})
