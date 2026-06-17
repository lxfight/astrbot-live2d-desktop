import { ref, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  buildModelConfigFromCatalog,
  generateExpressionAliasFromId,
  generateMotionAliasFromId,
  type ExpressionAliasConfig,
  type ModelAliasConfigV2,
  type ModelCatalogPayload,
  type MotionAliasConfig
} from '@/shared/modelConfigFactory'
import { mergeAliasConfigWithCatalog } from '@/shared/modelAliasMerge'

type ReadableRef<T> = {
  readonly value: T
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function patchAliasById<T extends { id: string }>(rows: Ref<T[]>, id: string, patch: Partial<T>) {
  const index = rows.value.findIndex(row => row.id === id)
  if (index < 0) return
  rows.value[index] = { ...rows.value[index], ...patch }
}

export function useModelAliasConfigEditor(currentModelPath: ReadableRef<string>) {
  const { t } = useI18n()
  const message = useMessage()
  const loading = ref(false)
  const saving = ref(false)
  const motionAliases = ref<MotionAliasConfig[]>([])
  const expressionAliases = ref<ExpressionAliasConfig[]>([])

  async function loadFromModelCatalog() {
    const modelPath = currentModelPath.value
    if (!modelPath) return

    const catalogResult = await window.electron.model.getCatalog(modelPath)
    if (!catalogResult.success || !catalogResult.catalog) return

    const config = buildModelConfigFromCatalog(catalogResult.catalog as ModelCatalogPayload)
    motionAliases.value = config.motionAliases
    expressionAliases.value = config.expressionAliases
  }

  async function loadConfig() {
    const modelPath = currentModelPath.value
    if (!modelPath) return

    loading.value = true
    try {
      const result = await window.electron.modelConfig.load(modelPath)

      if (result.success && result.config) {
        const catalogResult = await window.electron.model.getCatalog(modelPath)
        if (catalogResult.success && catalogResult.catalog) {
          const merged = mergeAliasConfigWithCatalog(
            result.config,
            catalogResult.catalog as ModelCatalogPayload
          )
          motionAliases.value = merged.motionAliases
          expressionAliases.value = merged.expressionAliases
        } else {
          motionAliases.value = result.config.motionAliases
          expressionAliases.value = result.config.expressionAliases
        }
      } else {
        await loadFromModelCatalog()
      }
    } catch (error) {
      console.error('[model alias config] load failed:', error)
      await loadFromModelCatalog()
    } finally {
      loading.value = false
    }
  }

  function autoGenerateAliases() {
    motionAliases.value = motionAliases.value.map(motion =>
      !motion.name || motion.name === motion.id
        ? { ...motion, name: generateMotionAliasFromId(motion.id) }
        : motion
    )
    expressionAliases.value = expressionAliases.value.map(expression =>
      !expression.name || expression.name === expression.id
        ? { ...expression, name: generateExpressionAliasFromId(expression.id) }
        : expression
    )
    message.success(t('settings.modelConfig.generated'))
  }

  async function saveConfig() {
    const modelPath = currentModelPath.value
    if (!modelPath) return

    saving.value = true
    try {
      const config: ModelAliasConfigV2 = {
        modelPath,
        version: '2.0',
        motionAliases: motionAliases.value,
        expressionAliases: expressionAliases.value
      }

      const result = await window.electron.modelConfig.save(config)
      if (result.success) {
        message.success(t('settings.modelConfig.saved'))
      } else {
        message.error(result.error || t('settings.modelConfig.saveFailed'))
      }
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      saving.value = false
    }
  }

  function patchMotionAlias(id: string, patch: Partial<MotionAliasConfig>) {
    patchAliasById(motionAliases, id, patch)
  }

  function patchExpressionAlias(id: string, patch: Partial<ExpressionAliasConfig>) {
    patchAliasById(expressionAliases, id, patch)
  }

  return {
    loading,
    saving,
    motionAliases,
    expressionAliases,
    loadConfig,
    autoGenerateAliases,
    saveConfig,
    patchMotionAlias,
    patchExpressionAlias
  }
}
