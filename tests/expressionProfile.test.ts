import { afterEach, describe, expect, test, vi } from 'vitest'

import { loadExpressionProfile } from '../src/utils/cubism/expressionProfile'

describe('loadExpressionProfile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('skips fetch when compatibility discovery confirms profile is absent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const profile = await loadExpressionProfile('/models/sample/sample.model3.json', null)

    expect(profile).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('loads explicit profile file path when compatibility discovery provides one', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, aliases: { Smile: ['happy'] } })
    } as Response)

    const profile = await loadExpressionProfile(
      '/models/sample/sample.model3.json',
      'astrbot.live2d.profile.json'
    )

    expect(fetchSpy).toHaveBeenCalledWith('/models/sample/astrbot.live2d.profile.json')
    expect(profile).toEqual({
      version: 1,
      aliases: { Smile: ['happy'] }
    })
  })

  test('normalizes supported fields and ignores unsupported legacy planner fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 2,
        aliases: { Smile: ['happy', 'Happy'] },
        tags: { Smile: ['joyful'] },
        semanticPresets: {
          happy: [{ id: 'Smile', weight: 1 }, 'Smile', { id: '  ' }]
        },
        comboPresets: {
          ignored: [{ id: 'Smile', weight: 1 }]
        }
      })
    } as Response)

    const profile = await loadExpressionProfile(
      '/models/sample/sample.model3.json',
      'astrbot.live2d.profile.json'
    )

    expect(profile).toEqual({
      version: 2,
      aliases: { Smile: ['happy'] },
      tags: { Smile: ['joyful'] },
      semanticPresets: {
        happy: ['Smile']
      }
    })
  })
})
