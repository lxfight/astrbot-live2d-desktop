import path from 'path'
import { createCubismModelLoadDescriptor } from './cubismModelDiscovery'
import {
  buildModelCatalogFromManifest,
  buildModelConfigFromCatalog,
  type ModelAliasConfigV2,
  type ModelCatalogPayload
} from '../../src/shared/modelConfigFactory'
import { mergeAliasConfigWithCatalog } from '../../src/shared/modelAliasMerge'
import { readModelConfigFile, writeModelConfigFile } from './modelConfigPaths'

export async function buildCatalogForAbsoluteModel(
  modelPath: string,
  modelAbsolutePath: string
): Promise<ModelCatalogPayload> {
  const descriptor = await createCubismModelLoadDescriptor(modelPath, modelAbsolutePath)
  const displayName = path.basename(path.dirname(modelAbsolutePath)) || 'model'
  return buildModelCatalogFromManifest(modelPath, descriptor.compatibilityManifest, displayName)
}

export function applyMotionDurationOverrides(
  catalog: ModelCatalogPayload,
  durations: Record<string, number> | undefined
): ModelCatalogPayload {
  if (!durations || Object.keys(durations).length === 0) {
    return catalog
  }
  return {
    ...catalog,
    motions: catalog.motions.map(motion => {
      const override = durations[motion.id]
      if (typeof override === 'number' && override > 0) {
        return { ...motion, durationMs: Math.round(override) }
      }
      return motion
    })
  }
}

export async function ensureModelAliasConfig(
  modelPath: string,
  modelAbsolutePath: string,
  motionDurations?: Record<string, number>
): Promise<{ config: ModelAliasConfigV2; created: boolean }> {
  const catalog = applyMotionDurationOverrides(
    await buildCatalogForAbsoluteModel(modelPath, modelAbsolutePath),
    motionDurations
  )

  const existing = await readModelConfigFile(modelPath)
  if (existing) {
    const merged = mergeAliasConfigWithCatalog(existing, catalog)
    const expanded =
      merged.motionAliases.length > existing.motionAliases.length ||
      merged.expressionAliases.length > existing.expressionAliases.length
    if (expanded) {
      await writeModelConfigFile(merged)
      return { config: merged, created: false }
    }
    return { config: existing, created: false }
  }

  const config = buildModelConfigFromCatalog(catalog)
  await writeModelConfigFile(config)
  return { config, created: true }
}
