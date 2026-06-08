import { describe, expect, it } from 'vitest'

import { buildExpressionCatalog } from '../src/utils/cubism/expressionCatalog'
import type { ExpressionCatalogInput } from '../src/utils/cubism/expressionCatalog'

const parsedExpressions: ExpressionCatalogInput[] = [
  {
    source: 'companion',
    parsed: {
      id: 'Smile',
      file: 'Smile.exp3.json',
      parameters: [{ parameterId: 'ParamMouthSmile', blend: 'add', value: 1 }],
      parameterIds: ['ParamMouthSmile'],
      blendSummary: { additive: 1, multiply: 0, overwrite: 0 },
      parseWarnings: []
    }
  },
  {
    source: 'model3',
    parsed: {
      id: 'Think',
      file: 'Think.exp3.json',
      parameters: [{ parameterId: 'ParamBrowAngle', blend: 'multiply', value: 0.8 }],
      parameterIds: ['ParamBrowAngle'],
      blendSummary: { additive: 0, multiply: 1, overwrite: 0 },
      parseWarnings: []
    }
  }
]

describe('buildExpressionCatalog', () => {
  it('merges profile aliases and semantic presets', () => {
    const result = buildExpressionCatalog(parsedExpressions, {
      aliases: {
        Smile: ['happy_face', '开心']
      },
      tags: {
        Smile: ['happy', 'speaking'],
        Think: ['thinking']
      },
      semanticPresets: {
        happy: ['happy_face'],
        speaking: ['Smile'],
        thinking: ['Think']
      }
    })

    expect(result.entries).toEqual([
      expect.objectContaining({
        id: 'Smile',
        aliases: ['Smile', 'happy_face', '开心'],
        tags: expect.arrayContaining(['happy', 'speaking']),
        conflictGroups: expect.arrayContaining(['emotion', 'speech']),
        supportsCombo: true
      }),
      expect.objectContaining({
        id: 'Think',
        aliases: ['Think'],
        tags: ['thinking'],
        conflictGroups: ['cognition'],
        supportsCombo: true
      })
    ])
    expect(result.semanticPresets).toEqual({
      happy: ['Smile'],
      speaking: ['Smile'],
      thinking: ['Think']
    })
  })

  it('ignores expressions without executable parameters', () => {
    const result = buildExpressionCatalog(
      [
        ...parsedExpressions,
        {
          source: 'scan',
          parsed: {
            id: 'Broken',
            file: 'Broken.exp3.json',
            parameters: [],
            parameterIds: [],
            blendSummary: { additive: 0, multiply: 0, overwrite: 0 },
            parseWarnings: ['表情文件缺少 Parameters 数组']
          }
        }
      ],
      {
        semanticPresets: {
          happy: ['Broken', 'Smile']
        }
      }
    )

    expect(result.entries.map(entry => entry.id)).toEqual(['Smile', 'Think'])
    expect(result.semanticPresets.happy).toEqual(['Smile'])
  })

  it('does not infer semantic tags from scan-only expressions without explicit profile tags', () => {
    const result = buildExpressionCatalog(
      [
        {
          source: 'scan',
          parsed: {
            id: 'Laugh',
            file: 'Laugh.exp3.json',
            parameters: [{ parameterId: 'ParamMouthOpenY', blend: 'add', value: 1 }],
            parameterIds: ['ParamMouthOpenY'],
            blendSummary: { additive: 1, multiply: 0, overwrite: 0 },
            parseWarnings: []
          }
        }
      ],
      null
    )

    expect(result.entries).toEqual([
      expect.objectContaining({
        id: 'Laugh',
        tags: [],
        conflictGroups: [],
        supportsCombo: true
      })
    ])
    expect(result.semanticPresets).toEqual({})
  })

  it('allows explicit profile tags to opt scan expressions into semantic routing', () => {
    const result = buildExpressionCatalog(
      [
        {
          source: 'scan',
          parsed: {
            id: 'Laugh',
            file: 'Laugh.exp3.json',
            parameters: [{ parameterId: 'ParamMouthOpenY', blend: 'add', value: 1 }],
            parameterIds: ['ParamMouthOpenY'],
            blendSummary: { additive: 1, multiply: 0, overwrite: 0 },
            parseWarnings: []
          }
        }
      ],
      {
        tags: {
          Laugh: ['happy']
        }
      }
    )

    expect(result.entries).toEqual([
      expect.objectContaining({
        id: 'Laugh',
        tags: ['happy'],
        conflictGroups: ['emotion']
      })
    ])
    expect(result.semanticPresets).toEqual({
      happy: ['Laugh']
    })
  })

  it('uses profile semantic presets as the source of truth', () => {
    const result = buildExpressionCatalog(parsedExpressions, {
      semanticPresets: {
        happy: [],
        thinking: ['Think']
      },
      tags: {
        Think: ['thinking']
      }
    })

    expect(result.entries).toEqual([
      expect.objectContaining({
        id: 'Smile',
        tags: []
      }),
      expect.objectContaining({
        id: 'Think',
        tags: ['thinking']
      })
    ])
    expect(result.semanticPresets).toEqual({
      happy: [],
      thinking: ['Think']
    })
  })
})
