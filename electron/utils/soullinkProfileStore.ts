import { createHash } from 'crypto'
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { ModelProfile } from '@soullink-emotion/engine'
import { validateModelProfile } from '@soullink-emotion/engine/internal'

export type SoullinkProfileReadResult = {
  profile: ModelProfile | null
  profilePath: string
  errors: string[]
  warnings: string[]
}

export function getSoullinkProfileDir(): string {
  return path.join(app.getPath('userData'), 'soullink-profiles')
}

export function getSoullinkProfilePath(
  modelPath: string,
  profileDir: string = getSoullinkProfileDir()
): string {
  const hash = createHash('sha256').update(modelPath).digest('hex')
  return path.join(profileDir, `${hash}.json`)
}

function validateProfile(
  raw: unknown,
  modelPath: string
): {
  profile: ModelProfile | null
  errors: string[]
  warnings: string[]
} {
  const validation = validateModelProfile(raw)
  const errors = [...validation.errors]

  if (validation.ok && validation.profile.modelPath !== modelPath) {
    errors.push('Profile modelPath does not match the requested model')
  }

  return {
    profile: errors.length === 0 ? validation.profile : null,
    errors,
    warnings: validation.warnings
  }
}

export async function readSoullinkProfileFile(
  modelPath: string,
  profileDir: string = getSoullinkProfileDir()
): Promise<SoullinkProfileReadResult> {
  const profilePath = getSoullinkProfilePath(modelPath, profileDir)

  try {
    const raw = JSON.parse(await fs.readFile(profilePath, 'utf8'))
    return {
      ...validateProfile(raw, modelPath),
      profilePath
    }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return { profile: null, profilePath, errors: [], warnings: [] }
    }

    return {
      profile: null,
      profilePath,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: []
    }
  }
}

export async function writeSoullinkProfileFile(
  modelPath: string,
  rawProfile: unknown,
  profileDir: string = getSoullinkProfileDir()
): Promise<{ profile: ModelProfile; profilePath: string; warnings: string[] }> {
  const validation = validateProfile(rawProfile, modelPath)
  if (!validation.profile) {
    throw new Error(`Invalid Soullink profile: ${validation.errors.join('; ')}`)
  }

  await fs.mkdir(profileDir, { recursive: true })
  const profilePath = getSoullinkProfilePath(modelPath, profileDir)
  const temporaryPath = `${profilePath}.${process.pid}.${Date.now()}.tmp`

  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(validation.profile, null, 2)}\n`, 'utf8')
    await fs.rename(temporaryPath, profilePath)
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {})
  }

  return {
    profile: validation.profile,
    profilePath,
    warnings: validation.warnings
  }
}
