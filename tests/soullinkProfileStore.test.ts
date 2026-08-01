import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getSoullinkProfilePath,
  readSoullinkProfileFile,
  writeSoullinkProfileFile
} from '../electron/utils/soullinkProfileStore'
import { createStandardSoullinkProfile } from '../src/utils/soullinkEmotion'

const temporaryDirectories: string[] = []

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'astrbot-soullink-profile-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('Soullink profile store', () => {
  it('creates a stable path for nested and non-ASCII model paths', () => {
    const profileDir = createTemporaryDirectory()
    const modelPath = '/models/角色/嵌套/avatar.model3.json'

    expect(getSoullinkProfilePath(modelPath, profileDir)).toBe(
      getSoullinkProfilePath(modelPath, profileDir)
    )
    expect(getSoullinkProfilePath(modelPath, profileDir)).not.toBe(
      getSoullinkProfilePath(`${modelPath}.other`, profileDir)
    )
  })

  it('writes and reads a validated model profile', async () => {
    const profileDir = createTemporaryDirectory()
    const modelPath = '/models/avatar/model.model3.json'
    const profile = createStandardSoullinkProfile(modelPath, 'Avatar')

    const saved = await writeSoullinkProfileFile(modelPath, profile, profileDir)
    const loaded = await readSoullinkProfileFile(modelPath, profileDir)

    expect(saved.profilePath).toBe(getSoullinkProfilePath(modelPath, profileDir))
    expect(loaded.errors).toEqual([])
    expect(loaded.profile).toEqual(profile)
  })

  it('returns no profile when the file is missing or malformed', async () => {
    const profileDir = createTemporaryDirectory()
    const modelPath = '/models/avatar/model.model3.json'

    expect((await readSoullinkProfileFile(modelPath, profileDir)).profile).toBeNull()

    fs.writeFileSync(getSoullinkProfilePath(modelPath, profileDir), '{invalid json', 'utf8')
    const malformed = await readSoullinkProfileFile(modelPath, profileDir)
    expect(malformed.profile).toBeNull()
    expect(malformed.errors).toHaveLength(1)
  })

  it('rejects a profile belonging to another model', async () => {
    const profileDir = createTemporaryDirectory()
    const profile = createStandardSoullinkProfile('/models/other/model.model3.json', 'Other')

    await expect(
      writeSoullinkProfileFile('/models/avatar/model.model3.json', profile, profileDir)
    ).rejects.toThrow('modelPath does not match')
  })
})
