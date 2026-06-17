import { describe, expect, it } from 'vitest'

import {
  createPerformExpressionRequest,
  normalizePerformExpressionResetPolicy
} from '../src/windows/composables/performExpressionRequest'

const aliasResolver = {
  getExpressionId(name: string) {
    return name === '微笑' ? 'Smile' : undefined
  }
}

describe('createPerformExpressionRequest', () => {
  it('maps v2 expression names to runtime expression ids', () => {
    expect(
      createPerformExpressionRequest(
        {
          type: 'expression',
          name: '微笑',
          holdMs: 1600,
          resetPolicy: 'previous',
          fade: 300
        },
        aliasResolver
      )
    ).toEqual({
      id: 'Smile',
      combo: undefined,
      semantic: undefined,
      fade: 300,
      holdMs: 1600,
      resetPolicy: 'previous',
      motionType: undefined
    })
  })

  it('maps combo alias ids before sending to the Live2D runtime', () => {
    expect(
      createPerformExpressionRequest(
        {
          type: 'expression',
          combo: [
            { id: '微笑', weight: 0.8 },
            { id: 'Thinking', weight: 0.3 }
          ],
          resetPolicy: 'hold',
          motionType: 'happy'
        },
        aliasResolver
      )
    ).toEqual({
      id: undefined,
      combo: [
        { id: 'Smile', weight: 0.8 },
        { id: 'Thinking', weight: 0.3 }
      ],
      semantic: undefined,
      fade: undefined,
      holdMs: undefined,
      resetPolicy: 'keep',
      motionType: 'happy'
    })
  })

  it('keeps the previous default reset policy for older perform payloads', () => {
    expect(normalizePerformExpressionResetPolicy(undefined)).toBe('previous')
    expect(normalizePerformExpressionResetPolicy('fadeOut')).toBe('neutral')
    expect(normalizePerformExpressionResetPolicy('default')).toBe('neutral')
    expect(normalizePerformExpressionResetPolicy('hold')).toBe('keep')
  })
})
