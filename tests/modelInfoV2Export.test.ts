import { describe, expect, it } from 'vitest'

import { convertModelInfoToV2 } from '../src/utils/modelInfoConverter'
import { AliasMapper } from '../electron/utils/aliasMapper'

const baseModelInfo = {
  name: 'Haru',
  motionGroups: {
    Happy: [{ index: 0, file: 'happy.motion3.json' }]
  },
  expressions: ['Smile', 'Angry'],
  capabilities: {
    expressionCombo: true,
    semanticExpression: true,
    expressionProfile: true
  },
  expressionCatalog: [
    {
      id: 'Smile',
      aliases: ['Smile', '微笑'],
      tags: ['happy'],
      conflictGroups: ['emotion'],
      supportsCombo: true
    },
    {
      id: 'Angry',
      aliases: ['Angry', '生气'],
      tags: ['angry'],
      conflictGroups: ['emotion'],
      supportsCombo: true
    }
  ],
  semanticPresets: {
    happy: ['Smile'],
    angry: ['Angry']
  },
  discovery: {
    mode: 'standard' as const,
    sources: ['model3' as const],
    companionFiles: [],
    standardDeclaredExpressions: 1,
    standardDeclaredMotionGroups: 1,
    discoveredExpressions: 0,
    discoveredMotionGroups: 0,
    scannedExpressionCount: 0,
    scannedMotionCount: 0,
    warnings: []
  }
}

describe('model info v2 export', () => {
  it('preserves expression capabilities when auto-converting model info', () => {
    const payload = convertModelInfoToV2(baseModelInfo)

    expect(payload.capabilities).toEqual({
      idleMode: 'noise+motion',
      llmControlled: true,
      expressionCombo: true,
      semanticExpression: true,
      expressionProfile: true
    })
    expect(payload.expressionCatalog).toEqual(baseModelInfo.expressionCatalog)
    expect(payload.semanticPresets).toEqual(baseModelInfo.semanticPresets)
    expect(payload.discovery).toEqual(baseModelInfo.discovery)
  })

  it('preserves expression capabilities when exporting configured aliases', () => {
    const mapper = new AliasMapper()
    mapper.loadFromConfig({
      modelPath: '/models/haru.model3.json',
      version: '2.0',
      motionAliases: [
        {
          id: 'Happy_00',
          name: '开心动作',
          category: 'action',
          duration: 1800,
          enabled: true
        }
      ],
      expressionAliases: [
        {
          id: 'Smile',
          name: '微笑',
          enabled: true
        },
        {
          id: 'Angry',
          name: '生气',
          enabled: true
        }
      ]
    })

    const payload = mapper.exportForAdapter('Haru', baseModelInfo)

    expect(payload.expressions).toEqual([
      { id: 'Smile', name: '微笑' },
      { id: 'Angry', name: '生气' }
    ])
    expect(payload.capabilities).toEqual({
      idleMode: 'noise+motion',
      llmControlled: true,
      expressionCombo: true,
      semanticExpression: true,
      expressionProfile: true
    })
    expect(payload.expressionCatalog).toEqual(baseModelInfo.expressionCatalog)
    expect(payload.semanticPresets).toEqual(baseModelInfo.semanticPresets)
  })

  it('does not expose disabled expression metadata to the adapter', () => {
    const mapper = new AliasMapper()
    mapper.loadFromConfig({
      modelPath: '/models/haru.model3.json',
      version: '2.0',
      motionAliases: [],
      expressionAliases: [
        {
          id: 'Smile',
          name: '微笑',
          enabled: true
        },
        {
          id: 'Angry',
          name: '生气',
          enabled: false
        }
      ]
    })

    const payload = mapper.exportForAdapter('Haru', baseModelInfo)

    expect(payload.expressions).toEqual([{ id: 'Smile', name: '微笑' }])
    expect(payload.expressionCatalog).toEqual([baseModelInfo.expressionCatalog[0]])
    expect(payload.semanticPresets).toEqual({ happy: ['Smile'] })
    expect(payload.capabilities).toMatchObject({
      expressionCombo: true,
      semanticExpression: true
    })
  })
})
