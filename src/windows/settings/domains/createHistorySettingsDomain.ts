import { inject, ref, type InjectionKey, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { format } from 'date-fns'
import { useDialog, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useConnectionStore } from '@/stores/connection'
import { createDeferredTaskCache } from '../composables/createDeferredTaskCache'

export interface HistorySettingsDomain {
  currentPage: Ref<number>
  dateRange: Ref<[number, number] | null>
  directionFilter: Ref<string | null>
  directionOptions: ReadonlyArray<{ label: string; value: string }>
  downloadHistoryFile: (item: any) => Promise<void>
  ensureMessagesReady: (force?: boolean) => Promise<void>
  ensureStatisticsReady: (force?: boolean) => Promise<void>
  handleClearHistory: () => void
  handleDateRangeChange: (value: [number, number] | null) => void
  handleDirectionFilterChange: () => void
  handlePageChange: (page: number) => void
  handlePageSizeChange: (size: number) => void
  handleRefreshMessages: () => Promise<void>
  handleSearch: () => void
  historyResourceBaseUrl: Ref<string>
  historyResourcePath: Ref<string>
  historyResourceToken: Ref<string>
  invalidate: (keys?: string[]) => void
  keyword: Ref<string>
  messages: Ref<any[]>
  openHistoryFile: (item: any) => Promise<void>
  pageSize: Ref<number>
  statisticsData: Ref<any[]>
  syncResourceConfig: (force?: boolean) => Promise<void>
  totalMessages: Ref<number>
  totalPages: Ref<number>
}

export const historySettingsDomainKey: InjectionKey<HistorySettingsDomain> = Symbol('history-settings-domain')

export function useHistorySettingsDomain() {
  const domain = inject(historySettingsDomainKey)
  if (!domain) {
    throw new Error('HistorySettingsDomain 未注入')
  }

  return domain
}

type DialogApi = ReturnType<typeof useDialog>
type MessageApi = ReturnType<typeof useMessage>

interface CreateHistorySettingsDomainOptions {
  dialog: DialogApi
  message: MessageApi
}

function createDefaultDateRange(): [number, number] {
  return [
    Date.now() - 7 * 24 * 60 * 60 * 1000,
    Date.now(),
  ]
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) {
    return error
  }

  if (typeof error === 'string' && error) {
    return new Error(error)
  }

  return new Error(fallback)
}

export function createHistorySettingsDomain(
  options: CreateHistorySettingsDomainOptions,
): HistorySettingsDomain {
  const { dialog, message } = options
  const { t } = useI18n()
  const connectionStore = useConnectionStore()
  const taskCache = createDeferredTaskCache()

  const messages = ref<any[]>([])
  const statisticsData = ref<any[]>([])
  const currentPage = ref(1)
  const pageSize = ref(20)
  const totalMessages = ref(0)
  const totalPages = ref(1)
  const keyword = ref('')
  const directionFilter = ref<string | null>(null)
  const dateRange = ref<[number, number] | null>(createDefaultDateRange())

  const historyResourceBaseUrl = ref('')
  const historyResourcePath = ref('/resources')
  const historyResourceToken = ref('')

  const directionOptions = [
    { label: t('settings.history.direction.outgoing'), value: 'outgoing' },
    { label: t('settings.history.direction.incoming'), value: 'incoming' },
  ] as const

  async function syncResourceConfig(force = false) {
    await taskCache.runTask('history:resource-config', async () => {
      await connectionStore.ensureInitialized()

      if (force) {
        await Promise.all([
          connectionStore.reloadPersistedSettings(),
          connectionStore.refreshLifecycleSnapshot(),
        ])
      }

      historyResourceBaseUrl.value = connectionStore.resourceBaseUrl
      historyResourcePath.value = connectionStore.resourcePath
      historyResourceToken.value = connectionStore.resourceToken
    }, force)
  }

  async function loadMessages() {
    try {
      const requestOptions: Record<string, unknown> = {
        limit: pageSize.value,
        offset: (currentPage.value - 1) * pageSize.value,
      }

      const normalizedKeyword = keyword.value.trim()
      if (normalizedKeyword) {
        requestOptions.keyword = normalizedKeyword
      }

      if (directionFilter.value) {
        requestOptions.direction = directionFilter.value
      }

      requestOptions.repairOffline = true
      requestOptions.resourceContext = {
        resourceBaseUrl: historyResourceBaseUrl.value,
        resourcePath: historyResourcePath.value,
        resourceToken: historyResourceToken.value,
      }

      const result = await window.electron.history.getMessages(requestOptions)
      if (!result.success) {
        throw new Error(result.error || t('toast.historyLoadedFailed'))
      }

      messages.value = result.data || []
      totalMessages.value = (result as any).total || 0
      totalPages.value = Math.max(1, Math.ceil(totalMessages.value / pageSize.value) || 1)
    } catch (error) {
      throw normalizeError(error, t('toast.historyLoadedFailed'))
    }
  }

  async function loadStatistics() {
    if (!dateRange.value) {
      statisticsData.value = []
      return
    }

    const [start, end] = dateRange.value
    const startDate = format(new Date(start), 'yyyy-MM-dd')
    const endDate = format(new Date(end), 'yyyy-MM-dd')

    try {
      const result = await window.electron.history.getStatistics(startDate, endDate)
      if (!result.success) {
        throw new Error(result.error || t('toast.historyStatsFailed'))
      }

      statisticsData.value = result.data || []
    } catch (error) {
      throw normalizeError(error, t('toast.historyStatsFailed'))
    }
  }

  async function ensureMessagesReady(force = false) {
    await Promise.all([
      syncResourceConfig(force),
      taskCache.runTask('history:messages', loadMessages, force),
    ])
  }

  async function ensureStatisticsReady(force = false) {
    await taskCache.runTask('history:statistics', loadStatistics, force)
  }

  async function refreshMessages(options: { syncResource?: boolean } = {}) {
    if (options.syncResource) {
      await syncResourceConfig(true)
    }

    await taskCache.runTask('history:messages', loadMessages, true)
  }

  async function refreshStatistics() {
    await taskCache.runTask('history:statistics', loadStatistics, true)
  }

  const debouncedRefreshMessages = useDebounceFn(() => {
    void refreshMessages().catch((error) => {
      message.error(normalizeError(error, t('toast.historyLoadedFailed')).message)
    })
  }, 250)

  function handleSearch() {
    currentPage.value = 1
    debouncedRefreshMessages()
  }

  function handleDirectionFilterChange() {
    currentPage.value = 1
    void refreshMessages().catch((error) => {
      message.error(normalizeError(error, t('toast.historyLoadedFailed')).message)
    })
  }

  function handlePageChange(page: number) {
    currentPage.value = page
    void refreshMessages().catch((error) => {
      message.error(normalizeError(error, t('toast.historyLoadedFailed')).message)
    })
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    currentPage.value = 1
    void refreshMessages().catch((error) => {
      message.error(normalizeError(error, t('toast.historyLoadedFailed')).message)
    })
  }

  function handleDateRangeChange(value: [number, number] | null) {
    dateRange.value = value
    void refreshStatistics().catch((error) => {
      message.error(normalizeError(error, t('toast.historyStatsFailed')).message)
    })
  }

  function getHistoryFileSource(item: any): string | null {
    if (typeof item?.src === 'string' && item.src.trim()) {
      return item.src.trim()
    }

    return null
  }

  function getHistoryFileName(item: any): string {
    if (typeof item?.name === 'string' && item.name.trim()) {
      return item.name.trim()
    }

    if (typeof item?.label === 'string' && item.label.trim()) {
      return item.label.trim()
    }

    return 'file.bin'
  }

  async function openHistoryFile(item: any) {
    const source = getHistoryFileSource(item)
    if (!source) {
      message.warning(t('toast.fileResourceUnavailable'))
      return
    }

    try {
      const result = await window.electron.window.openResource(source, getHistoryFileName(item))
      if (!result.success) {
        throw new Error(result.error || t('toast.fileOpenFailed', { error: '' }))
      }
    } catch (error) {
      message.error(t('toast.fileOpenFailed', { error: normalizeError(error, '打开文件失败').message }))
    }
  }

  async function downloadHistoryFile(item: any) {
    const source = getHistoryFileSource(item)
    if (!source) {
      message.warning(t('toast.fileResourceUnavailable'))
      return
    }

    try {
      const result = await window.electron.window.saveResource(source, getHistoryFileName(item))
      if (result.canceled) {
        return
      }

      if (!result.success) {
        throw new Error(result.error || t('toast.fileDownloadFailed', { error: '' }))
      }

      message.success(t('toast.fileSaved'))
    } catch (error) {
      message.error(t('toast.fileDownloadFailed', { error: normalizeError(error, '下载文件失败').message }))
    }
  }

  async function handleRefreshMessages() {
    try {
      await Promise.all([
        refreshMessages({ syncResource: true }),
        refreshStatistics(),
      ])
      message.success(t('toast.historyRefreshed'))
    } catch (error) {
      message.error(normalizeError(error, t('toast.historyLoadedFailed')).message)
    }
  }

  function handleClearHistory() {
    dialog.error({
      title: t('settings.history.clearTitle'),
      content: t('settings.history.clearContent'),
      positiveText: t('dialog.confirm'),
      negativeText: t('dialog.cancel'),
      onPositiveClick: async () => {
        try {
          const result = await window.electron.history.clearHistory()
          if (!result.success) {
            throw new Error(result.error || t('toast.historyClearFailed', { error: '' }))
          }

          currentPage.value = 1
          await Promise.all([
            refreshMessages(),
            refreshStatistics(),
          ])
          message.success(t('toast.historyCleared'))
        } catch (error) {
          message.error(t('toast.historyClearFailed', { error: normalizeError(error, '清空历史记录失败').message }))
        }
      },
    })
  }

  return {
    currentPage,
    dateRange,
    directionFilter,
    directionOptions,
    downloadHistoryFile,
    ensureMessagesReady,
    ensureStatisticsReady,
    handleClearHistory,
    handleDateRangeChange,
    handleDirectionFilterChange,
    handlePageChange,
    handlePageSizeChange,
    handleRefreshMessages,
    handleSearch,
    historyResourceBaseUrl,
    historyResourcePath,
    historyResourceToken,
    invalidate: taskCache.invalidate,
    keyword,
    messages,
    openHistoryFile,
    pageSize,
    statisticsData,
    syncResourceConfig,
    totalMessages,
    totalPages,
  }
}
