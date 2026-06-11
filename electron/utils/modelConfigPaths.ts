import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'
import type { ModelAliasConfigV2 } from '../../src/shared/modelConfigFactory'

export function getModelConfigDir(): string {
  return path.join(app.getPath('userData'), 'model-configs')
}

export function getModelConfigPath(modelPath: string): string {
  const hash = createHash('md5').update(modelPath).digest('hex')
  return path.join(getModelConfigDir(), `${hash}.json`)
}

export async function readModelConfigFile(modelPath: string): Promise<ModelAliasConfigV2 | null> {
  try {
    const configPath = getModelConfigPath(modelPath)
    const data = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(data) as ModelAliasConfigV2
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function writeModelConfigFile(config: ModelAliasConfigV2): Promise<string> {
  const configDir = getModelConfigDir()
  await fs.mkdir(configDir, { recursive: true })
  const configPath = getModelConfigPath(config.modelPath)
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  return configPath
}
