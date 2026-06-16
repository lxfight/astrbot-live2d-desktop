import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, test } from 'vitest'

import { discoverCubismModelCompatibility } from '../electron/utils/cubismModelDiscovery'

const tempRoots: string[] = []

function createTempModelDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astrbot-cubism-discovery-'))
  tempRoots.push(tempDir)
  return tempDir
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, value, 'utf8')
}

describe('discoverCubismModelCompatibility', () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const target = tempRoots.pop()
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true })
      }
    }
  })

  test('reads companion declarations and resolves basename-only file references', async () => {
    const modelDir = createTempModelDir()
    writeText(path.join(modelDir, 'sample.moc3'), 'moc')
    writeText(path.join(modelDir, 'texture_00.png'), 'png')
    writeJson(path.join(modelDir, 'astrbot.live2d.profile.json'), {
      aliases: {
        水印: ['watermark']
      }
    })
    writeText(path.join(modelDir, 'expressions', 'watermark.exp3.json'), '{"Parameters":[]}')
    writeText(path.join(modelDir, 'motions', 'IDLE.motion3.json'), '{}')
    writeText(path.join(modelDir, 'motions', 'blush.motion3.json'), '{}')

    writeJson(path.join(modelDir, 'sample.model3.json'), {
      FileReferences: {
        Moc: 'sample.moc3',
        Textures: ['texture_00.png']
      }
    })

    writeJson(path.join(modelDir, 'sample.vtube.json'), {
      FileReferences: {
        IdleAnimation: 'IDLE.motion3.json'
      },
      Hotkeys: [
        {
          Name: '水印',
          Action: 'ToggleExpression',
          File: 'watermark.exp3.json'
        },
        {
          Name: '脸红',
          Action: 'TriggerAnimation',
          File: 'blush.motion3.json'
        }
      ]
    })

    const manifest = await discoverCubismModelCompatibility(
      path.join(modelDir, 'sample.model3.json')
    )

    expect(manifest.discovery.mode).toBe('compatibility')
    expect(manifest.expressionProfileFile).toBe('astrbot.live2d.profile.json')
    expect(manifest.discovery.sources).toEqual(['companion'])
    expect(manifest.discovery.scannedExpressionCount).toBe(1)
    expect(manifest.discovery.scannedMotionCount).toBe(2)
    expect(manifest.expressions).toEqual([
      expect.objectContaining({
        id: '水印',
        file: 'expressions/watermark.exp3.json',
        aliases: expect.arrayContaining(['水印', 'watermark']),
        source: 'companion'
      })
    ])
    expect(manifest.motions).toEqual({
      Idle: [{ file: 'motions/IDLE.motion3.json', source: 'companion' }],
      脸红: [{ file: 'motions/blush.motion3.json', source: 'companion' }]
    })
  })

  test('falls back to directory scan when no companion declarations exist', async () => {
    const modelDir = createTempModelDir()
    writeText(path.join(modelDir, 'sample.moc3'), 'moc')
    writeText(path.join(modelDir, 'texture_00.png'), 'png')
    writeText(path.join(modelDir, 'Zzz.exp3.json'), '{"Parameters":[]}')
    writeText(path.join(modelDir, 'motions', 'Idle_01.motion3.json'), '{}')
    writeText(path.join(modelDir, 'motions', 'Wave.motion3.json'), '{}')

    writeJson(path.join(modelDir, 'sample.model3.json'), {
      FileReferences: {
        Moc: 'sample.moc3',
        Textures: ['texture_00.png']
      }
    })

    const manifest = await discoverCubismModelCompatibility(
      path.join(modelDir, 'sample.model3.json')
    )

    expect(manifest.discovery.mode).toBe('compatibility')
    expect(manifest.expressionProfileFile).toBeNull()
    expect(manifest.expressions).toEqual([
      {
        id: 'Zzz',
        file: 'Zzz.exp3.json',
        aliases: ['Zzz'],
        source: 'scan'
      }
    ])
    expect(manifest.motions).toEqual({
      Idle: [{ file: 'motions/Idle_01.motion3.json', source: 'scan' }],
      Wave: [{ file: 'motions/Wave.motion3.json', source: 'scan' }]
    })
  })

  test('keeps standard model expression names as primary ids', async () => {
    const modelDir = createTempModelDir()
    writeText(path.join(modelDir, 'sample.moc3'), 'moc')
    writeText(path.join(modelDir, 'texture_00.png'), 'png')
    writeText(path.join(modelDir, 'expressions', 'smile.exp3.json'), '{"Parameters":[]}')

    writeJson(path.join(modelDir, 'sample.model3.json'), {
      FileReferences: {
        Moc: 'sample.moc3',
        Textures: ['texture_00.png'],
        Expressions: [
          {
            Name: 'SmileName',
            File: 'expressions/smile.exp3.json'
          }
        ]
      }
    })

    const manifest = await discoverCubismModelCompatibility(
      path.join(modelDir, 'sample.model3.json')
    )

    expect(manifest.expressions).toEqual([
      {
        id: 'SmileName',
        file: 'expressions/smile.exp3.json',
        aliases: ['SmileName', 'smile'],
        source: 'model3'
      }
    ])
  })

  test('falls back to file basename when companion hotkey names are empty', async () => {
    const modelDir = createTempModelDir()
    writeText(path.join(modelDir, 'sample.moc3'), 'moc')
    writeText(path.join(modelDir, 'texture_00.png'), 'png')
    writeText(path.join(modelDir, '脸红.exp3.json'), '{"Parameters":[]}')
    writeText(path.join(modelDir, 'motions', '红温.motion3.json'), '{}')
    writeText(path.join(modelDir, 'motions', 'IDLE.motion3.json'), '{}')

    writeJson(path.join(modelDir, 'sample.model3.json'), {
      FileReferences: {
        Moc: 'sample.moc3',
        Textures: ['texture_00.png']
      }
    })

    writeJson(path.join(modelDir, 'sample.vtube.json'), {
      FileReferences: {
        IdleAnimation: 'IDLE.motion3.json'
      },
      Hotkeys: [
        {
          Name: '',
          Action: 'ToggleExpression',
          File: '脸红.exp3.json'
        },
        {
          Name: '',
          Action: 'TriggerAnimation',
          File: '红温.motion3.json'
        }
      ]
    })

    const manifest = await discoverCubismModelCompatibility(
      path.join(modelDir, 'sample.model3.json')
    )

    expect(manifest.expressions).toEqual([
      {
        id: '脸红',
        file: '脸红.exp3.json',
        aliases: ['脸红'],
        source: 'companion'
      }
    ])
    expect(manifest.motions).toEqual({
      Idle: [{ file: 'motions/IDLE.motion3.json', source: 'companion' }],
      红温: [{ file: 'motions/红温.motion3.json', source: 'companion' }]
    })
  })
})
