import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, test } from 'vitest'
import {
  formatCubismAssetIssues,
  validateCubismModelAssets
} from '../electron/utils/cubismAssetManifest'

const tempRoots: string[] = []

function createTempModelDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astrbot-cubism-'))
  tempRoots.push(tempDir)
  return tempDir
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

describe('validateCubismModelAssets', () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const target = tempRoots.pop()
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true })
      }
    }
  })

  test('reports no required issues for complete minimal model', () => {
    const modelDir = createTempModelDir()
    fs.writeFileSync(path.join(modelDir, 'sample.moc3'), 'moc')
    fs.writeFileSync(path.join(modelDir, 'texture_00.png'), 'png')
    fs.writeFileSync(path.join(modelDir, 'idle.motion3.json'), '{}')

    writeJson(path.join(modelDir, 'sample.model3.json'), {
      FileReferences: {
        Moc: 'sample.moc3',
        Textures: ['texture_00.png'],
        Motions: {
          Idle: [{ File: 'idle.motion3.json' }]
        }
      }
    })

    const result = validateCubismModelAssets(path.join(modelDir, 'sample.model3.json'))

    expect(result.manifest.moc).toBe('sample.moc3')
    expect(result.issues.filter((issue) => issue.severity === 'required')).toHaveLength(0)
    expect(result.issues.filter((issue) => issue.severity === 'optional')).toHaveLength(0)
  })

  test('reports required moc and texture issues', () => {
    const modelDir = createTempModelDir()

    writeJson(path.join(modelDir, 'broken.model3.json'), {
      FileReferences: {
        Moc: 'broken.moc3',
        Textures: ['missing/texture_00.png']
      }
    })

    const result = validateCubismModelAssets(path.join(modelDir, 'broken.model3.json'))
    const formatted = formatCubismAssetIssues(result.issues)

    expect(formatted).toContain('required:moc:broken.moc3')
    expect(formatted).toContain('required:texture:missing/texture_00.png')
  })

  test('reports optional motion expression physics pose and userdata issues', () => {
    const modelDir = createTempModelDir()
    fs.writeFileSync(path.join(modelDir, 'sample.moc3'), 'moc')
    fs.writeFileSync(path.join(modelDir, 'texture_00.png'), 'png')

    writeJson(path.join(modelDir, 'sample.model3.json'), {
      FileReferences: {
        Moc: 'sample.moc3',
        Textures: ['texture_00.png'],
        Physics: 'sample.physics3.json',
        Pose: 'sample.pose3.json',
        UserData: 'sample.userdata3.json',
        Motions: {
          Idle: [{ File: 'idle.motion3.json' }]
        },
        Expressions: [{ File: 'smile.exp3.json' }]
      }
    })

    const result = validateCubismModelAssets(path.join(modelDir, 'sample.model3.json'))
    const formatted = formatCubismAssetIssues(result.issues)

    expect(formatted).toContain('optional:motion:idle.motion3.json')
    expect(formatted).toContain('optional:expression:smile.exp3.json')
    expect(formatted).toContain('optional:physics:sample.physics3.json')
    expect(formatted).toContain('optional:pose:sample.pose3.json')
    expect(formatted).toContain('optional:userData:sample.userdata3.json')
  })
})
