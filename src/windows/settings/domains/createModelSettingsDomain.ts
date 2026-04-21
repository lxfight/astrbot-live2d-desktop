import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessage } from 'naive-ui'
import { useModelStore } from '@/stores/model'
import { useThemeStore } from '@/stores/theme'

export interface ModelSettingsDomain {
  currentModelDisplay: ComputedRef<string>
  currentModelInitial: ComputedRef<string>
  currentModelPath: Ref<string>
  currentModelScaleValue: ComputedRef<number>
  currentModelStatusClass: ComputedRef<string>
  currentModelStatusLabel: ComputedRef<string>
  ensureLibraryReady: (force?: boolean) => Promise<void>
  getModelPreviewStyle: (modelPath: string) => Record<string, string>
  handleDeleteModel: (modelName: string) => Promise<void>
  handleImportModel: () => Promise<void>
  handleLoadModel: (modelPath: string) => Promise<void>
  handleModelScaleChange: (value: number) => void
  handleResetModelScale: () => void
  inactiveModelSwatchStyle: ComputedRef<Record<string, string>>
  libraryStatus: Ref<'idle' | 'loading' | 'ready' | 'error'>
  modelList: Ref<Array<{ name: string; path: string }>>
  resolvedModelName: Ref<string>
  sourceColor: Ref<string>
  themeSwatchStyle: ComputedRef<Record<string, string>>
}

export const modelSettingsDomainKey: InjectionKey<ModelSettingsDomain> = Symbol('model-settings-domain')

export function useModelSettingsDomain() {
  const domain = inject(modelSettingsDomainKey)
  if (!domain) {
    throw new Error('ModelSettingsDomain 未注入')
  }

  return domain
}

type MessageApi = ReturnType<typeof useMessage>

export function createModelSettingsDomain(message: MessageApi): ModelSettingsDomain {
  const modelStore = useModelStore()
  const themeStore = useThemeStore()
  const { currentModelPath, palette, resolvedModelName, sourceColor } = storeToRefs(themeStore)

  const modelList = ref<Array<{ name: string; path: string }>>([])
  const libraryStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const themeSwatchStyle = computed(() => ({
    background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
    boxShadow: `0 12px 24px ${palette.value.shadowColor}`,
  }))

  const inactiveModelSwatchStyle = computed(() => ({
    background: 'linear-gradient(135deg, rgba(var(--color-accent-rgb), 0.18), rgba(255, 255, 255, 0.04))',
    boxShadow: 'none',
  }))

  const currentModelDisplay = computed(() => resolvedModelName.value || '尚未加载模型')
  const currentModelInitial = computed(() => currentModelDisplay.value.slice(0, 1).toUpperCase())
  const currentModelStatusLabel = computed(() => currentModelPath.value ? '使用中' : '未加载')
  const currentModelStatusClass = computed(() => (
    currentModelPath.value ? 'status-pill--accent' : 'status-pill--warning'
  ))
  const currentModelScaleValue = computed(() => {
    if (!currentModelPath.value) {
      return 1.0
    }

    return modelStore.getModelScale(currentModelPath.value)
  })

  async function loadModelList() {
    const result = await window.electron.model.getList()
    if (!result.success || !result.models) {
      throw new Error(result.error || '加载模型列表失败')
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
      message.error(`选择文件夹失败: ${result.error}`)
      return
    }

    const folderName = result.folderPath?.split(/[/\\]/).pop() || 'model'
    const importResult = await window.electron.model.import(result.folderPath!, folderName)
    if (!importResult.success) {
      message.error(`导入模型失败: ${importResult.error}`)
      return
    }

    if (importResult.modelFiles && importResult.modelFiles.length > 1 && importResult.chosenFile) {
      message.info(`检测到多个模型文件，已自动选择：${importResult.chosenFile}`)
    }

    message.success('模型导入成功')
    await ensureLibraryReady(true)
  }

  async function handleLoadModel(modelPath: string) {
    await window.electron.model.load(modelPath)
    message.success('模型加载指令已发送')
  }

  async function handleDeleteModel(modelName: string) {
    const result = await window.electron.model.delete(modelName)
    if (!result.success) {
      message.error(`删除失败: ${result.error}`)
      return
    }

    message.success('模型已删除')
    await ensureLibraryReady(true)
  }

  return {
    currentModelDisplay,
    currentModelInitial,
    currentModelPath,
    currentModelScaleValue,
    currentModelStatusClass,
    currentModelStatusLabel,
    ensureLibraryReady,
    getModelPreviewStyle,
    handleDeleteModel,
    handleImportModel,
    handleLoadModel,
    handleModelScaleChange,
    handleResetModelScale,
    inactiveModelSwatchStyle,
    libraryStatus,
    modelList,
    resolvedModelName,
    sourceColor,
    themeSwatchStyle,
  }
}
