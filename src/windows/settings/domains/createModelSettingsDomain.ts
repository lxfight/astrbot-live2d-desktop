import { computed, inject, ref, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useModelStore } from '@/stores/model'
import { useThemeStore } from '@/stores/theme'
import {
  cloneExpressionTypePresets,
  createEmptyExpressionTypePresets,
  type Live2DExpressionTypeEntry,
  type Live2DExpressionTypePresetMap
} from '@/shared/live2dExpressionTypes'
import type { ModelBehaviorConfig } from '@/shared/modelBehavior'

export interface ModelSettingsDomain {
  currentModelDisplay: ComputedRef<string>
  currentModelInitial: ComputedRef<string>
  currentModelPath: ComputedRef<string>
  currentModelScaleValue: ComputedRef<number>
  currentModelStatusClass: ComputedRef<string>
  currentModelStatusLabel: ComputedRef<string>
  currentModelBehavior: ComputedRef<ModelBehaviorConfig>
  ensureLibraryReady: (force?: boolean) => Promise<void>
  ensureFavoritesReady: (force?: boolean) => Promise<void>
  ensureExpressionTypesReady: (force?: boolean) => Promise<void>
  expressionTypeStatus: Ref<'idle' | 'loading' | 'ready' | 'error'>
  expressionTypeSaving: Ref<boolean>
  expressionTypeProfilePath: Ref<string>
  expressionTypeExpressions: Ref<Live2DExpressionTypeEntry[]>
  expressionTypePresets: Ref<Live2DExpressionTypePresetMap>
  favoritesList: Ref<Array<ModelFavorite>>
  favoritesStatus: Ref<'idle' | 'loading' | 'ready' | 'error'>
  allTags: Ref<string[]>
  getModelPreviewStyle: (modelPath: string) => Record<string, string>
  handleDeleteModel: (modelName: string) => Promise<void>
  handleExpressionTypeChange: (type: keyof Live2DExpressionTypePresetMap, value: string[]) => void
  handleIdleActivityChange: (value: number) => void
  handlePersistentExpressionsChange: (names: string[]) => void
  handleImportModel: () => Promise<void>
  handleBatchImportModels: () => Promise<void>
  handleLoadModel: (modelPath: string) => Promise<void>
  handleModelScaleChange: (value: number) => void
  handleResetModelScale: () => void
  handleSaveExpressionTypes: () => Promise<void>
  handleAddFavorite: (modelPath: string, displayName?: string, notes?: string) => Promise<void>
  handleRemoveFavorite: (modelPath: string) => Promise<void>
  handleUpdateFavorite: (modelPath: string, displayName?: string, notes?: string) => Promise<void>
  handleAddTag: (modelPath: string, tag: string) => Promise<void>
  handleRemoveTag: (modelPath: string, tag: string) => Promise<void>
  inactiveModelSwatchStyle: ComputedRef<Record<string, string>>
  libraryStatus: Ref<'idle' | 'loading' | 'ready' | 'error'>
  modelList: Ref<Array<{ name: string; path: string }>>
  resolvedModelName: Ref<string>
  sourceColor: Ref<string>
  themeSwatchStyle: ComputedRef<Record<string, string>>
}

interface ModelFavorite {
  id: number
  modelPath: string
  displayName: string | null
  notes: string | null
  addedAt: string
  tags: string[]
}

export const modelSettingsDomainKey: InjectionKey<ModelSettingsDomain> =
  Symbol('model-settings-domain')

export function useModelSettingsDomain() {
  const domain = inject(modelSettingsDomainKey)
  if (!domain) {
    throw new Error('ModelSettingsDomain 未注入')
  }

  return domain
}

type MessageApi = ReturnType<typeof useMessage>

export function createModelSettingsDomain(message: MessageApi): ModelSettingsDomain {
  const { t } = useI18n()
  const modelStore = useModelStore()
  const themeStore = useThemeStore()
  const {
    currentModelPath: themeCurrentModelPath,
    palette,
    resolvedModelName,
    sourceColor
  } = storeToRefs(themeStore)

  const modelList = ref<Array<{ name: string; path: string }>>([])
  const libraryStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const favoritesList = ref<Array<ModelFavorite>>([])
  const favoritesStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const allTags = ref<string[]>([])
  const expressionTypeStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const expressionTypeSaving = ref(false)
  const expressionTypeProfilePath = ref('')
  const expressionTypeExpressions = ref<Live2DExpressionTypeEntry[]>([])
  const expressionTypePresets = ref<Live2DExpressionTypePresetMap>(
    createEmptyExpressionTypePresets()
  )

  const themeSwatchStyle = computed(() => ({
    background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
    boxShadow: `0 12px 24px ${palette.value.shadowColor}`
  }))

  const inactiveModelSwatchStyle = computed(() => ({
    background:
      'linear-gradient(135deg, rgba(var(--color-accent-rgb), 0.18), rgba(255, 255, 255, 0.04))',
    boxShadow: 'none'
  }))

  const currentModelPath = computed(
    () => themeCurrentModelPath.value || modelStore.currentModel || modelStore.getLastModel() || ''
  )
  const currentModelDisplay = computed(() =>
    currentModelPath.value
      ? resolvedModelName.value ||
        currentModelPath.value.split(/[/\\]/).filter(Boolean).pop() ||
        t('settings.model.currentModel')
      : t('settings.model.noModelLoaded')
  )
  const currentModelInitial = computed(() => currentModelDisplay.value.slice(0, 1).toUpperCase())
  const currentModelStatusLabel = computed(() =>
    currentModelPath.value ? t('settings.model.status.inUse') : t('settings.model.status.notLoaded')
  )
  const currentModelStatusClass = computed(() =>
    currentModelPath.value ? 'status-pill--accent' : 'status-pill--warning'
  )
  const currentModelScaleValue = computed(() => {
    if (!currentModelPath.value) {
      return 1.0
    }

    return modelStore.getModelScale(currentModelPath.value)
  })

  async function loadModelList() {
    const result = await window.electron.model.getList()
    if (!result.success || !result.models) {
      throw new Error(result.error || t('toast.modelListFailed'))
    }

    modelList.value = result.models
  }

  async function ensureLibraryReady(force = false) {
    if (libraryStatus.value === 'ready' && !force) {
      return
    }

    libraryStatus.value = 'loading'

    try {
      await loadModelList()
      libraryStatus.value = 'ready'
    } catch (error) {
      libraryStatus.value = 'error'
      throw error
    }
  }

  async function ensureFavoritesReady(force = false) {
    if (favoritesStatus.value === 'ready' && !force) {
      return
    }

    favoritesStatus.value = 'loading'

    try {
      const result = await window.electron.modelFavorites.getAll()
      if (!result.success || !result.favorites) {
        throw new Error(result.error || t('toast.favoriteLoadFailed'))
      }

      favoritesList.value = result.favorites

      const tagsResult = await window.electron.modelFavorites.getAllTags()
      if (tagsResult.success && tagsResult.tags) {
        allTags.value = tagsResult.tags
      }

      favoritesStatus.value = 'ready'
    } catch (error) {
      favoritesStatus.value = 'error'
      throw error
    }
  }

  async function ensureExpressionTypesReady(force = false) {
    if (!currentModelPath.value) {
      expressionTypeStatus.value = 'idle'
      expressionTypeProfilePath.value = ''
      expressionTypeExpressions.value = []
      expressionTypePresets.value = createEmptyExpressionTypePresets()
      return
    }

    if (expressionTypeStatus.value === 'ready' && !force) {
      return
    }

    expressionTypeStatus.value = 'loading'

    try {
      const result = await window.electron.model.getExpressionTypes(currentModelPath.value)
      if (!result.success || !result.expressions || !result.presets) {
        throw new Error(result.error || t('toast.modelExpressionReadFailed'))
      }

      expressionTypeProfilePath.value = result.profilePath || ''
      expressionTypeExpressions.value = result.expressions
      expressionTypePresets.value = result.presets
      expressionTypeStatus.value = 'ready'
    } catch (error) {
      expressionTypeStatus.value = 'error'
      throw error
    }
  }

  watch(currentModelPath, (nextPath, previousPath) => {
    if (nextPath === previousPath) {
      return
    }

    expressionTypeStatus.value = 'idle'
    expressionTypeProfilePath.value = ''
    expressionTypeExpressions.value = []
    expressionTypePresets.value = createEmptyExpressionTypePresets()
  })

  const currentModelBehavior = computed(() =>
    modelStore.getModelBehavior(currentModelPath.value || undefined)
  )

  function handleIdleActivityChange(value: number) {
    if (!currentModelPath.value) {
      return
    }
    modelStore.setModelIdleActivity(value, currentModelPath.value)
  }

  function handlePersistentExpressionsChange(names: string[]) {
    if (!currentModelPath.value) {
      return
    }
    modelStore.setModelPersistentExpressions(names, currentModelPath.value)
  }

  function handleExpressionTypeChange(type: keyof Live2DExpressionTypePresetMap, value: string[]) {
    expressionTypePresets.value = {
      ...expressionTypePresets.value,
      [type]: value
    }
  }

  async function handleSaveExpressionTypes() {
    const modelPath = currentModelPath.value
    if (!modelPath) {
      message.error(t('settings.model.notLoadedWarn'))
      return
    }
    if (expressionTypeSaving.value) {
      return
    }

    expressionTypeSaving.value = true
    try {
      const plainPresets = cloneExpressionTypePresets(expressionTypePresets.value)
      window.electron.log.info('[设置] 开始保存表情类型配置', {
        modelPath,
        assignedTypeCount: Object.values(plainPresets).filter(items => items.length > 0).length
      })
      const result = await window.electron.model.saveExpressionTypes(modelPath, plainPresets)
      if (!result.success) {
        message.error(t('toast.expressionSaveFailed', { error: result.error }))
        return
      }

      await ensureExpressionTypesReady(true)
      const loadResult = await window.electron.model.load(modelPath)
      if (!loadResult.success) {
        message.warning(t('settings.model.expressionReloadFailed', { error: loadResult.error }))
        return
      }

      message.success(t('toast.expressionSaved'))
    } catch (error: any) {
      const messageText = error?.message || String(error)
      window.electron.log.error('[设置] 保存表情类型配置异常', messageText)
      message.error(t('toast.expressionSaveFailed', { error: messageText }))
    } finally {
      expressionTypeSaving.value = false
    }
  }

  function handleModelScaleChange(value: number) {
    if (currentModelPath.value) {
      modelStore.setModelScale(value, currentModelPath.value)
    }
  }

  function handleResetModelScale() {
    handleModelScaleChange(1.0)
  }

  function getModelPreviewStyle(modelPath: string) {
    return modelPath === currentModelPath.value
      ? themeSwatchStyle.value
      : inactiveModelSwatchStyle.value
  }

  async function handleImportModel() {
    const result = await window.electron.model.selectFolder()
    if (result.canceled) {
      return
    }

    if (!result.success) {
      message.error(t('main.model.folderFailed', { message: result.error }))
      return
    }

    const folderName = result.folderPath?.split(/[/\\]/).pop() || 'model'
    const importResult = await window.electron.model.import(result.folderPath!, folderName)
    if (!importResult.success) {
      message.error(t('main.status.modelImportFailed', { message: importResult.error }))
      return
    }

    if (importResult.modelFiles && importResult.modelFiles.length > 1 && importResult.chosenFile) {
      message.info(t('main.model.multiFileDetected', { file: importResult.chosenFile }))
    }

    if (Array.isArray(importResult.warnings) && importResult.warnings.length > 0) {
      message.warning(
        t('main.model.compatibilityWarning', { warnings: importResult.warnings.join('；') })
      )
    }

    message.success(t('toast.modelImported'))
    await ensureLibraryReady(true)
  }

  async function handleBatchImportModels() {
    const result = await window.electron.model.selectFolders()
    if (result.canceled) {
      return
    }

    if (!result.success) {
      message.error(t('main.model.folderFailed', { message: result.error }))
      return
    }

    const folderPaths = result.folderPaths ?? []
    if (folderPaths.length === 0) {
      return
    }

    let importedCount = 0
    const failures: string[] = []

    for (const folderPath of folderPaths) {
      const folderName = folderPath.split(/[/\\]/).pop() || 'model'
      try {
        const importResult = await window.electron.model.import(folderPath, folderName)
        if (!importResult.success) {
          failures.push(`${folderName}: ${importResult.error ?? 'unknown'}`)
          continue
        }
        importedCount += 1
      } catch (error: any) {
        failures.push(`${folderName}: ${error?.message ?? String(error)}`)
      }
    }

    await ensureLibraryReady(true)

    if (importedCount > 0) {
      message.success(t('settings.model.library.batchImportSummary', { count: importedCount }))
    }
    if (failures.length > 0) {
      message.error(
        t('settings.model.library.batchImportFailures', {
          count: failures.length,
          details: failures.join('；')
        })
      )
    }
  }

  async function handleLoadModel(modelPath: string) {
    await window.electron.model.load(modelPath)
    message.success(t('toast.modelLoadSent'))
  }

  async function handleDeleteModel(modelName: string) {
    const result = await window.electron.model.delete(modelName)
    if (!result.success) {
      message.error(t('toast.modelDeleteFailed', { error: result.error }))
      return
    }

    message.success(t('toast.modelDeleted'))
    await ensureLibraryReady(true)
  }

  async function handleAddFavorite(modelPath: string, displayName?: string, notes?: string) {
    const result = await window.electron.modelFavorites.add(modelPath, displayName, notes)
    if (!result.success) {
      message.error(t('toast.favoriteAddFailed', { error: result.error }))
      return
    }

    message.success(t('toast.favoriteAdded'))
    await ensureFavoritesReady(true)
  }

  async function handleRemoveFavorite(modelPath: string) {
    const result = await window.electron.modelFavorites.remove(modelPath)
    if (!result.success) {
      message.error(t('toast.favoriteRemoveFailed', { error: result.error }))
      return
    }

    message.success(t('toast.favoriteRemoved'))
    await ensureFavoritesReady(true)
  }

  async function handleUpdateFavorite(modelPath: string, displayName?: string, notes?: string) {
    const result = await window.electron.modelFavorites.update(modelPath, displayName, notes)
    if (!result.success) {
      message.error(t('toast.favoriteUpdateFailed', { error: result.error }))
      return
    }

    message.success(t('toast.favoriteUpdated'))
    await ensureFavoritesReady(true)
  }

  async function handleAddTag(modelPath: string, tag: string) {
    const result = await window.electron.modelFavorites.addTag(modelPath, tag)
    if (!result.success) {
      message.error(t('toast.tagAddFailed', { error: result.error }))
      return
    }

    await ensureFavoritesReady(true)
  }

  async function handleRemoveTag(modelPath: string, tag: string) {
    const result = await window.electron.modelFavorites.removeTag(modelPath, tag)
    if (!result.success) {
      message.error(t('toast.tagRemoveFailed', { error: result.error }))
      return
    }

    await ensureFavoritesReady(true)
  }

  return {
    currentModelDisplay,
    currentModelInitial,
    currentModelPath,
    currentModelScaleValue,
    currentModelStatusClass,
    currentModelStatusLabel,
    currentModelBehavior,
    ensureLibraryReady,
    ensureFavoritesReady,
    ensureExpressionTypesReady,
    expressionTypeSaving,
    expressionTypeStatus,
    expressionTypeProfilePath,
    expressionTypeExpressions,
    expressionTypePresets,
    favoritesList,
    favoritesStatus,
    allTags,
    getModelPreviewStyle,
    handleDeleteModel,
    handleExpressionTypeChange,
    handleIdleActivityChange,
    handlePersistentExpressionsChange,
    handleImportModel,
    handleBatchImportModels,
    handleLoadModel,
    handleModelScaleChange,
    handleResetModelScale,
    handleSaveExpressionTypes,
    handleAddFavorite,
    handleRemoveFavorite,
    handleUpdateFavorite,
    handleAddTag,
    handleRemoveTag,
    inactiveModelSwatchStyle,
    libraryStatus,
    modelList,
    resolvedModelName,
    sourceColor,
    themeSwatchStyle
  }
}
