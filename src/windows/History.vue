<template>
  <div class="history-window">
    <header class="history-titlebar window-drag-region" @dblclick="handleTitleBarDoubleClick">
      <div class="history-titlebar__brand">
        <span class="history-titlebar__identity">
          <span class="history-theme-swatch history-theme-swatch--title" :style="themeDotStyle"></span>
          <span class="history-titlebar__name">AstrBot Live2D Desktop</span>
        </span>
        <span class="history-titlebar__divider"></span>
        <span class="history-titlebar__view">{{ activeTabMeta.label }}</span>
      </div>

      <div class="history-titlebar__actions window-no-drag">
        <button class="history-titlebar__button" type="button" aria-label="最小化" @click="handleMinimizeWindow">
          <Minus :size="16" />
        </button>
        <button
          class="history-titlebar__button"
          type="button"
          :aria-label="isWindowMaximized ? '还原' : '最大化'"
          @click="handleToggleWindowMaximize"
        >
          <component :is="isWindowMaximized ? Copy : Square" :size="14" />
        </button>
        <button
          class="history-titlebar__button history-titlebar__button--close"
          type="button"
          aria-label="关闭"
          @click="handleCloseWindow"
        >
          <X :size="16" />
        </button>
      </div>
    </header>

    <div class="history-workspace">
      <main class="history-main">
        <div class="history-main__viewport">
          <section class="desktop-toolbar history-overview">
            <div class="desktop-toolbar__copy history-overview__copy">
              <span class="history-overview__eyebrow">{{ activeTabMeta.eyebrow }}</span>
              <h2>{{ activeTabMeta.label }}</h2>
              <p>{{ activeTabMeta.description }}</p>
            </div>

            <div class="history-overview__metrics">
              <span class="history-meta-chip">
                <strong>消息</strong>
                <span>{{ totalMessages }}</span>
              </span>
              <span class="history-meta-chip">
                <strong>表演</strong>
                <span>{{ totalPerformances }}</span>
              </span>
              <span class="history-meta-chip">
                <strong>响应</strong>
                <span>{{ avgResponseTime }} ms</span>
              </span>
              <span class="history-meta-chip">
                <span class="history-theme-swatch" :style="themeSwatchStyle"></span>
                <span>{{ sourceColor.toUpperCase() }}</span>
              </span>
            </div>
          </section>

          <section class="desktop-toolbar history-toolbar">
            <div class="history-view-switch">
              <button
                v-for="item in tabItems"
                :key="item.key"
                class="history-view-switch__item"
                :class="{ 'history-view-switch__item--active': activeTab === item.key }"
                type="button"
                @click="activeTab = item.key"
              >
                <component :is="item.icon" :size="16" />
                <span>{{ item.label }}</span>
              </button>
            </div>

            <div class="history-toolbar__actions">
              <template v-if="activeTab === 'history'">
                <n-input
                  v-model:value="keyword"
                  placeholder="搜索消息..."
                  clearable
                  @update:value="handleSearch"
                >
                  <template #prefix>
                    <Search :size="16" />
                  </template>
                </n-input>

                <n-select
                  v-model:value="directionFilter"
                  :options="directionOptions"
                  placeholder="方向"
                  clearable
                  class="history-toolbar__select"
                  @update:value="loadMessages"
                />

                <n-button type="error" @click="handleClearHistory">清空历史</n-button>
              </template>

              <template v-else>
                <n-date-picker
                  v-model:value="dateRange"
                  type="daterange"
                  clearable
                  @update:value="handleDateRangeChange"
                />
              </template>

              <n-button type="primary" @click="handleRefresh">刷新</n-button>
            </div>
          </section>

          <template v-if="activeTab === 'statistics'">
            <div class="section-grid history-grid">
              <n-card title="消息趋势">
                <div ref="messageTrendRef" class="chart"></div>
              </n-card>
              <n-card title="表演元素使用量">
                <div ref="performElementRef" class="chart"></div>
              </n-card>
              <n-card title="活跃时段">
                <div ref="activeHoursRef" class="chart"></div>
              </n-card>
            </div>
          </template>

          <template v-else-if="activeTab === 'history'">
            <section class="panel-card history-panel-card">
              <div class="message-list">
                <article
                  v-for="msg in messages"
                  :key="msg.id"
                  :class="[
                    'message-item',
                    `message-item--${msg.direction}`,
                    { 'message-item--performance': msg.direction === 'incoming' && isPerformanceMessage(msg) },
                  ]"
                >
                  <div class="message-rail">
                    <span class="message-rail__icon">
                      <component :is="msg.direction === 'outgoing' ? User : Bot" :size="16" />
                    </span>
                    <span class="message-rail__label">{{ getMessageRailLabel(msg) }}</span>
                  </div>

                  <div class="message-record">
                    <header class="message-record__header">
                      <div class="message-record__identity">
                        <strong class="message-record__name">{{ getMessageAuthorLabel(msg) }}</strong>
                        <span class="message-record__kind" :class="`message-record__kind--${msg.direction}`">
                          {{ getMessageKindLabel(msg) }}
                        </span>
                      </div>

                      <div class="message-record__meta">
                        <span class="message-time">{{ formatTimestamp(msg.timestamp) }}</span>
                        <span class="message-id">ID {{ msg.message_id }}</span>
                      </div>
                    </header>

                    <div class="message-record__body">
                      <div v-if="msg.direction === 'incoming' && isPerformanceMessage(msg)" class="performance-content">
                        <div class="performance-header">
                          <n-icon size="18"><Drama /></n-icon>
                          <span>表演序列</span>
                        </div>
                        <div class="performance-elements">
                          <n-tag
                            v-for="(element, idx) in parseContent(msg.content)"
                            :key="idx"
                            :type="getElementTagType(element.type)"
                            size="small"
                          >
                            <template #icon>
                              <component :is="getElementIcon(element.type)" :size="14" />
                            </template>
                            {{ formatElement(element) }}
                          </n-tag>
                        </div>
                        <div v-if="getPerformancePreviewItems(msg.content).length" class="performance-text-preview">
                          <div
                            v-for="(item, previewIdx) in getPerformancePreviewItems(msg.content)"
                            :key="previewIdx"
                            class="content-item performance-preview-item"
                          >
                            <div v-if="item.type === 'text'" class="text-content" v-html="renderMarkdown(item.text)"></div>
                            <div v-else-if="item.type === 'image'" class="image-content performance-image-content">
                              <n-image :src="item.src" width="200" object-fit="cover" />
                            </div>
                            <div v-else-if="item.type === 'audio'" class="audio-content performance-audio-content">
                              <div class="media-content-header">
                                <n-icon size="18"><Mic /></n-icon>
                                <span>{{ item.label }}</span>
                              </div>
                              <audio class="audio-player" :src="item.src" controls preload="metadata" @click.stop></audio>
                            </div>
                            <div v-else-if="item.type === 'video'" class="video-content performance-video-content">
                              <div class="media-content-header">
                                <n-icon size="18"><Video /></n-icon>
                                <span>{{ item.label }}</span>
                              </div>
                              <video class="video-player" :src="item.src" controls preload="metadata" playsinline @click.stop></video>
                            </div>
                            <div v-else-if="item.type === 'file'" class="file-content performance-file-content">
                              <div class="file-header">
                                <div class="file-meta">
                                  <n-icon size="18"><FileText /></n-icon>
                                  <span class="file-name">{{ item.label }}</span>
                                </div>
                                <div class="file-actions">
                                  <button class="file-action-btn" @click.stop="openHistoryFile(item)">
                                    <ExternalLink :size="14" />
                                    <span>打开</span>
                                  </button>
                                  <button class="file-action-btn" @click.stop="downloadHistoryFile(item)">
                                    <Download :size="14" />
                                    <span>下载</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else>
                        <div v-for="(item, idx) in parseContent(msg.content)" :key="idx" class="content-item">
                          <div v-if="item.type === 'text'" class="text-content" v-html="renderMarkdown(item.text)"></div>
                          <div v-else-if="item.type === 'image'" class="image-content">
                            <n-image
                              v-if="resolveMessageImageSource(item)"
                              :src="resolveMessageImageSource(item) || undefined"
                              width="200"
                              object-fit="cover"
                            />
                            <div v-else class="image-placeholder">
                              <n-icon size="40"><ImageIcon /></n-icon>
                              <span>图片</span>
                            </div>
                          </div>
                          <div v-else-if="item.type === 'audio'" class="audio-content">
                            <template v-if="resolveMessageAudioSource(item)">
                              <div class="media-content-header">
                                <n-icon size="18"><Mic /></n-icon>
                                <span>{{ item.name || '语音消息' }}</span>
                              </div>
                              <audio
                                class="audio-player"
                                :src="resolveMessageAudioSource(item) || undefined"
                                controls
                                preload="metadata"
                                @click.stop
                              ></audio>
                            </template>
                            <div v-else class="media-placeholder">
                              <n-icon size="20"><Mic /></n-icon>
                              <span>语音消息</span>
                            </div>
                          </div>
                          <div v-else-if="item.type === 'video'" class="video-content">
                            <template v-if="resolveMessageVideoSource(item)">
                              <div class="media-content-header">
                                <n-icon size="18"><Video /></n-icon>
                                <span>{{ item.name || '视频' }}</span>
                              </div>
                              <video
                                class="video-player"
                                :src="resolveMessageVideoSource(item) || undefined"
                                controls
                                preload="metadata"
                                playsinline
                                @click.stop
                              ></video>
                            </template>
                            <div v-else class="media-placeholder">
                              <n-icon size="20"><Video /></n-icon>
                              <span>视频</span>
                            </div>
                          </div>
                          <div v-else-if="item.type === 'file'" class="file-content">
                            <template v-if="resolveMessageFileSource(item)">
                              <div class="file-header">
                                <div class="file-meta">
                                  <n-icon size="18"><FileText /></n-icon>
                                  <span class="file-name">{{ item.name || '文件' }}</span>
                                </div>
                                <div class="file-actions">
                                  <button class="file-action-btn" @click.stop="openHistoryFile(item)">
                                    <ExternalLink :size="14" />
                                    <span>打开</span>
                                  </button>
                                  <button class="file-action-btn" @click.stop="downloadHistoryFile(item)">
                                    <Download :size="14" />
                                    <span>下载</span>
                                  </button>
                                </div>
                              </div>
                            </template>
                            <div v-else class="media-placeholder">
                              <n-icon size="20"><FileText /></n-icon>
                              <span>{{ item.name || '文件' }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <n-pagination
                v-model:page="currentPage"
                :page-count="totalPages"
                :page-size="pageSize"
                show-size-picker
                :page-sizes="[10, 20, 50, 100]"
                @update:page="loadMessages"
                @update:page-size="handlePageSizeChange"
                class="history-pagination"
              />
            </section>
          </template>

          <template v-else>
            <div class="section-grid history-analysis-grid">
              <n-card title="动作使用排行">
                <div ref="motionRankRef" class="chart-large"></div>
              </n-card>

              <n-card title="表情使用排行">
                <div ref="expressionRankRef" class="chart-large"></div>
              </n-card>
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessage, useDialog } from 'naive-ui'
import { useDebounceFn } from '@vueuse/core'
import * as echarts from 'echarts'
import { endOfDay, format, startOfDay } from 'date-fns'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useConnectionStore } from '@/stores/connection'
import { useThemeStore } from '@/stores/theme'
import {
  buildHistoryRenderableItems,
  resolveHistoryMediaSource,
  resolveHistoryImageSource,
  type HistoryRenderableItem,
} from '@/utils/historyContent'
import {
  Search, User, Bot, Drama, Image as ImageIcon, Mic, Video,
  MessageSquare, Activity, Smile, Clock, HelpCircle,
  FileText, ExternalLink, Download, Copy, Minus, Square, X
} from 'lucide-vue-next'
import { withAlpha } from '@/utils/themePalette'

const message = useMessage()
const dialog = useDialog()
const connectionStore = useConnectionStore()
const themeStore = useThemeStore()
const { palette, sourceColor } = storeToRefs(themeStore)

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

// 使用 marked 的扩展系统来支持 LaTeX
marked.use({
  extensions: [
    {
      name: 'latex-inline',
      level: 'inline',
      start(src: string) { return src.indexOf('$') },
      tokenizer(src: string) {
        const match = src.match(/^\$([^\$]+)\$/)
        if (match) {
          return {
            type: 'latex-inline',
            raw: match[0],
            text: match[1]
          }
        }
      },
      renderer(token: any) {
        try {
          return katex.renderToString(token.text, { throwOnError: false })
        } catch (e) {
          return token.raw
        }
      }
    },
    {
      name: 'latex-block',
      level: 'block',
      start(src: string) { return src.indexOf('$$') },
      tokenizer(src: string) {
        const match = src.match(/^\$\$([^\$]+)\$\$/)
        if (match) {
          return {
            type: 'latex-block',
            raw: match[0],
            text: match[1]
          }
        }
      },
      renderer(token: any) {
        try {
          return katex.renderToString(token.text, {
            displayMode: true,
            throwOnError: false
          })
        } catch (e) {
          return token.raw
        }
      }
    }
  ]
})

const activeTab = ref('statistics')
const isWindowMaximized = ref(false)
const tabItems = [
  {
    key: 'statistics',
    icon: Activity,
    label: '概览',
    eyebrow: 'Metrics Overview',
    description: '用统一的深色面板查看消息趋势、活跃时段和表演总量。',
  },
  {
    key: 'history',
    icon: MessageSquare,
    label: '历史',
    eyebrow: 'Conversation Archive',
    description: '按时间回看消息、表演和资源内容，保留搜索与方向过滤。',
  },
  {
    key: 'analysis',
    icon: Smile,
    label: '分析',
    eyebrow: 'Behavior Analysis',
    description: '聚焦动作和表情分布，作为独立的分析工作区而不是网页标签页。',
  },
] as const

const activeTabMeta = computed(() => {
  return tabItems.find((item) => item.key === activeTab.value) ?? tabItems[0]
})

const themeSwatchStyle = computed(() => ({
  background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
  boxShadow: `0 12px 24px ${palette.value.shadowColor}`,
}))

const themeDotStyle = computed(() => ({
  background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
  boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.16), 0 0 14px ${palette.value.shadowColor}`,
}))

// 监听 tab 切换，修复图表不显示问题
watch(activeTab, (newTab) => {
  if (newTab === 'statistics') {
    nextTick(() => {
      // 切换回统计面板时，使用缓存数据重新渲染图表
      if (statisticsData.value.length > 0) {
        renderCharts(statisticsData.value)
      } else {
        loadStatistics()
      }
    })
  } else if (newTab === 'analysis') {
    nextTick(() => {
      loadAnalysisData()
      // 切换到分析面板时，使用缓存数据渲染分析图表
      if (statisticsData.value.length > 0) {
        renderCharts(statisticsData.value)
      } else {
        // 如果没有数据（比如直接打开分析页），则加载数据
        loadStatistics()
      }
    })
  }
})

watch(palette, () => {
  if (!statisticsData.value.length) {
    return
  }

  nextTick(() => {
    renderCharts(statisticsData.value)
  })
}, { deep: true })

function createDefaultDateRange(): [number, number] {
  return [
    Date.now() - 7 * 24 * 60 * 60 * 1000,
    Date.now(),
  ]
}

const dateRange = ref<[number, number] | null>(createDefaultDateRange())

// 缓存统计数据
const statisticsData = ref<any[]>([])

// 历史记录
const messages = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(0)
const keyword = ref('')
const directionFilter = ref<string>()

const directionOptions = [
  { label: '发送', value: 'outgoing' },
  { label: '接收', value: 'incoming' }
]

// 统计数据
const totalMessages = ref(0)
const totalPerformances = ref(0)
const avgResponseTime = ref(0)

// 图表引用
const messageTrendRef = ref<HTMLElement>()
const performElementRef = ref<HTMLElement>()
const activeHoursRef = ref<HTMLElement>()
const motionRankRef = ref<HTMLElement>()
const expressionRankRef = ref<HTMLElement>()

let charts: echarts.ECharts[] = []
const debouncedLoadMessages = useDebounceFn(() => {
  void loadMessages()
}, 250)
const MARKDOWN_CACHE_LIMIT = 500
const CONTENT_CACHE_LIMIT = 1000
const PREVIEW_CACHE_LIMIT = 500
const markdownRenderCache = new Map<string, string>()
const messageContentCache = new Map<string, any[]>()
const performancePreviewCache = new Map<string, HistoryRenderableItem[]>()
const historyResourceBaseUrl = ref('')
const historyResourcePath = ref('/resources')
const historyResourceToken = ref('')

function setCacheEntry<T>(cache: Map<string, T>, key: string, value: T, limit: number): T {
  if (!cache.has(key) && cache.size >= limit) {
    const oldestKey = cache.keys().next().value as string | undefined
    if (oldestKey !== undefined) {
      cache.delete(oldestKey)
    }
  }
  cache.set(key, value)
  return value
}

onMounted(async () => {
  themeStore.syncFromStorage()

  try {
    isWindowMaximized.value = await window.electron.window.isMaximizedCurrent()
  } catch {
    isWindowMaximized.value = false
  }

  await syncHistoryResourceConfig()
  await loadMessages()
  await loadStatistics()
  await loadAnalysisData()

  window.electron.window.onMaximizedChanged((maximized: boolean) => {
    isWindowMaximized.value = maximized
  })

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)

  // 监听窗口获得焦点时自动刷新
  window.addEventListener('focus', handleWindowFocus)
})

onUnmounted(() => {
  // 清理图表
  charts.forEach(chart => chart.dispose())
  charts = []
  markdownRenderCache.clear()
  messageContentCache.clear()
  performancePreviewCache.clear()

  window.removeEventListener('resize', handleResize)
  window.removeEventListener('focus', handleWindowFocus)
})

function handleWindowFocus() {
  void syncHistoryResourceConfig()
  void loadMessages()
  void loadStatistics()
  void loadAnalysisData()
}

async function syncHistoryResourceConfig() {
  connectionStore.reloadPersistedSettings()

  try {
    const session = await window.electron.bridge.getSession()
    connectionStore.applySessionState(session)
  } catch (error) {
    console.warn('[历史窗口] 获取资源配置失败:', error)
  }

  historyResourceBaseUrl.value = connectionStore.resourceBaseUrl
  historyResourcePath.value = connectionStore.resourcePath
  historyResourceToken.value = connectionStore.resourceToken
}
function handleResize() {
  charts.forEach(chart => chart.resize())
}

async function loadMessages() {
  try {
    const options: any = {
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value
    }

    if (keyword.value) {
      options.keyword = keyword.value
    }

    if (directionFilter.value) {
      options.direction = directionFilter.value
    }

    const result = await window.electron.history.getMessages(options)

    if (result.success) {
      messages.value = result.data || []
      totalMessages.value = (result as any).total || 0
      totalPages.value = Math.ceil(totalMessages.value / pageSize.value) || 1
    }
  } catch (error: any) {
    message.error(`加载历史记录失败: ${error.message}`)
  }
}

async function loadStatistics() {
  if (!dateRange.value) {
    statisticsData.value = []
    renderCharts([])
    return
  }

  const [start, end] = dateRange.value
  const startDate = format(new Date(start), 'yyyy-MM-dd')
  const endDate = format(new Date(end), 'yyyy-MM-dd')

  try {
    const result = await window.electron.history.getStatistics(startDate, endDate)

    if (result.success && result.data) {
      statisticsData.value = result.data
      await nextTick()
      renderCharts(result.data)
    }
  } catch (error: any) {
    console.error('[历史窗口] 加载统计数据失败:', error)
    message.error(`加载统计数据失败: ${error.message}`)
  }
}

async function loadAnalysisData() {
  try {
    if (!dateRange.value) {
      totalPerformances.value = 0
      avgResponseTime.value = 0
      return
    }

    // 获取所有消息用于计算总数
    const allMessagesResult = await window.electron.history.getMessages({ limit: 1 })
    if (allMessagesResult.success) {
      totalMessages.value = (allMessagesResult as any).total || 0
    }

    // 获取统计数据用于计算表演次数
    const [start, end] = dateRange.value
    const startDate = format(new Date(start), 'yyyy-MM-dd')
    const endDate = format(new Date(end), 'yyyy-MM-dd')

    const statsResult = await window.electron.history.getStatistics(startDate, endDate)
    if (statsResult.success && statsResult.data) {
      // 计算总表演次数（文字+图片+音频+视频）
      totalPerformances.value = statsResult.data.reduce((sum: number, d: any) => {
        return sum + (d.text_count || 0) + (d.image_count || 0) +
               (d.audio_count || 0) + (d.video_count || 0)
      }, 0)
    }

    const averageResult = await window.electron.history.getAverageResponseTime(
      startOfDay(new Date(start)).getTime(),
      endOfDay(new Date(end)).getTime()
    )
    if (averageResult.success) {
      avgResponseTime.value = averageResult.data || 0
    }
  } catch (error: any) {
    console.error('加载分析数据失败:', error)
  }
}

function renderCharts(data: any[]) {
  // 清理旧图表
  charts.forEach(chart => chart.dispose())
  charts = []

  if (!data || data.length === 0) {
    return
  }

  const chartColors = palette.value.chartPalette
  const axisColor = 'rgba(255, 255, 255, 0.18)'
  const labelColor = palette.value.textSecondary
  const gridColor = 'rgba(255, 255, 255, 0.08)'
  const tooltipBackground = 'rgba(8, 12, 20, 0.92)'

  const commonOption = {
    backgroundColor: 'transparent',
    textStyle: {
      color: labelColor
    },
    title: {
      textStyle: { color: palette.value.textPrimary }
    },
    tooltip: {
      backgroundColor: tooltipBackground,
      borderColor: axisColor,
      textStyle: { color: palette.value.textPrimary }
    },
    xAxis: {
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor },
      splitLine: { show: false }
    },
    yAxis: {
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor },
      splitLine: { lineStyle: { color: gridColor } }
    },
    grid: {
      top: 40,
      right: 20,
      bottom: 20,
      left: 40,
      containLabel: true
    }
  }

  // 消息趋势图
  if (messageTrendRef.value) {
    const chart = echarts.init(messageTrendRef.value)
    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map(d => d.date),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: { 
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: labelColor }
      },
      series: [{
        name: '消息数',
        type: 'line',
        data: data.map(d => d.message_count),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: chartColors[0] },
            { offset: 1, color: chartColors[1] }
          ])
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(chartColors[0], 0.28) },
            { offset: 1, color: withAlpha(chartColors[1], 0.06) }
          ])
        }
      }]
    })
    charts.push(chart)
  }

  // 表演元素使用量（柱状图）
  if (performElementRef.value) {
    const chart = echarts.init(performElementRef.value)
    const totalData = data.reduce((acc, d) => {
      acc.text += d.text_count || 0
      acc.image += d.image_count || 0
      acc.audio += d.audio_count || 0
      acc.video += d.video_count || 0
      return acc
    }, { text: 0, image: 0, audio: 0, video: 0 })

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['文字', '图片', '音频', '视频'],
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: gridColor } } },
      series: [{
        name: '使用量',
        type: 'bar',
        barWidth: '40%',
        data: [totalData.text, totalData.image, totalData.audio, totalData.video],
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors[2] },
            { offset: 1, color: chartColors[0] }
          ])
        }
      }]
    })
    charts.push(chart)
  }

  // 活跃时段（热力图风格柱状图）
  if (activeHoursRef.value) {
    const chart = echarts.init(activeHoursRef.value)
    const hourData = new Array(24).fill(0)

    data.forEach(d => {
      if (d.hour !== null && d.hour !== undefined) {
        hourData[d.hour] += d.message_count || 0
      }
    })

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, i) => `${i}`),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: gridColor } } },
      series: [{
        name: '消息数',
        type: 'bar',
        barWidth: '60%',
        data: hourData,
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors[3] },
            { offset: 1, color: chartColors[4] }
          ])
        }
      }]
    })
    charts.push(chart)
  }

  // 动作使用排行
  if (motionRankRef.value) {
    const chart = echarts.init(motionRankRef.value)
    const motionData = aggregateMotionUsage(data)

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: gridColor } } },
      yAxis: {
        type: 'category',
        data: motionData.map(d => d.name).slice(0, 10),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor, width: 80, overflow: 'truncate' }
      },
      grid: {
        left: 100, // 增加左边距以显示长标签
        right: 20,
        top: 20,
        bottom: 20
      },
      series: [{
        name: '使用次数',
        type: 'bar',
        data: motionData.map(d => d.value).slice(0, 10),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: chartColors[0] },
            { offset: 1, color: chartColors[5] }
          ])
        }
      }]
    })
    charts.push(chart)
  }

  // 表情使用排行
  if (expressionRankRef.value) {
    const chart = echarts.init(expressionRankRef.value)
    const expressionData = aggregateExpressionUsage(data)

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: gridColor } } },
      yAxis: {
        type: 'category',
        data: expressionData.map(d => d.name).slice(0, 10),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor, width: 80, overflow: 'truncate' }
      },
      grid: {
        left: 100,
        right: 20,
        top: 20,
        bottom: 20
      },
      series: [{
        name: '使用次数',
        type: 'bar',
        data: expressionData.map(d => d.value).slice(0, 10),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: chartColors[1] },
            { offset: 1, color: chartColors[3] }
          ])
        }
      }]
    })
    charts.push(chart)
  }
}

function aggregateMotionUsage(data: any[]) {
  const motionMap: Record<string, number> = {}

  data.forEach(d => {
    if (d.motion_usage) {
      try {
        const usage = JSON.parse(d.motion_usage)
        Object.entries(usage).forEach(([key, value]) => {
          motionMap[key] = (motionMap[key] || 0) + (value as number)
        })
      } catch (e) {}
    }
  })

  return Object.entries(motionMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

function aggregateExpressionUsage(data: any[]) {
  const expressionMap: Record<string, number> = {}

  data.forEach(d => {
    if (d.expression_usage) {
      try {
        const usage = JSON.parse(d.expression_usage)
        Object.entries(usage).forEach(([key, value]) => {
          expressionMap[key] = (expressionMap[key] || 0) + (value as number)
        })
      } catch (e) {}
    }
  })

  return Object.entries(expressionMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

function handleSearch() {
  currentPage.value = 1
  debouncedLoadMessages()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  void loadMessages()
}

function handleDateRangeChange(value: [number, number] | null) {
  dateRange.value = value ?? createDefaultDateRange()
  void loadStatistics()
  void loadAnalysisData()
}

function handleClearHistory() {
  dialog.error({
    title: '清空历史记录',
    content: '确定要清空所有历史记录吗？此操作不可恢复！',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await window.electron.history.clearHistory()
        if (result.success) {
          message.success('历史记录已清空')
          await loadMessages()
          await loadStatistics()
          await loadAnalysisData()
        }
      } catch (error: any) {
        message.error(`清空失败: ${error.message}`)
      }
    }
  })
}

async function handleRefresh() {
  await syncHistoryResourceConfig()
  await loadMessages()
  await loadStatistics()
  await loadAnalysisData()
  message.success('已刷新')
}

function getMessageAuthorLabel(msg: any): string {
  if (msg.direction === 'outgoing') {
    return msg.user_name || '我'
  }

  if (msg.user_id === 'server' || msg.user_id === 'bot') {
    return 'AstrBot'
  }

  return msg.user_name || msg.user_id || '未知来源'
}

function getMessageKindLabel(msg: any): string {
  if (msg.direction === 'incoming' && isPerformanceMessage(msg)) {
    return '表演'
  }

  return msg.direction === 'outgoing' ? '发送' : '接收'
}

function getMessageRailLabel(msg: any): string {
  if (msg.direction === 'incoming' && isPerformanceMessage(msg)) {
    return 'PERF'
  }

  return msg.direction === 'outgoing' ? 'OUT' : 'IN'
}

function formatTimestamp(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  const cached = markdownRenderCache.get(text)
  if (cached !== undefined) {
    return cached
  }

  try {
    const renderedHtml = marked.parse(text) as string
    const sanitized = DOMPurify.sanitize(renderedHtml, {
      USE_PROFILES: { html: true },
      ALLOW_DATA_ATTR: false
    }).trim()
    return setCacheEntry(markdownRenderCache, text, sanitized, MARKDOWN_CACHE_LIMIT)
  } catch (error) {
    console.error('[History] Markdown渲染失败:', error)
    return text
  }
}

function parseContent(content: string): any[] {
  const cached = messageContentCache.get(content)
  if (cached) {
    return cached
  }

  try {
    const parsed = JSON.parse(content)
    const result = Array.isArray(parsed) ? parsed : [parsed]
    return setCacheEntry(messageContentCache, content, result, CONTENT_CACHE_LIMIT)
  } catch (error) {
    const fallback = [{ type: 'text', text: String(content) }]
    return setCacheEntry(messageContentCache, content, fallback, CONTENT_CACHE_LIMIT)
  }
}

function isPerformanceMessage(msg: any): boolean {
  return msg.raw_text === '[表演序列]' || msg.user_id === 'server'
}

function getPerformancePreviewItems(content: string): HistoryRenderableItem[] {
  const cacheKey = `${historyResourceBaseUrl.value}::${historyResourcePath.value}::${historyResourceToken.value}::${content}`
  const cached = performancePreviewCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  try {
    const parsed = parseContent(content)
    const items = buildHistoryRenderableItems(parsed, {
      includeTtsText: true,
      resourceBaseUrl: historyResourceBaseUrl.value,
      resourcePath: historyResourcePath.value,
      resourceToken: historyResourceToken.value,
    })
    return setCacheEntry(performancePreviewCache, cacheKey, items, PREVIEW_CACHE_LIMIT)
  } catch {
    return setCacheEntry(performancePreviewCache, cacheKey, [], PREVIEW_CACHE_LIMIT)
  }
}

function resolveMessageImageSource(item: any): string | null {
  return resolveHistoryImageSource(item, {
    resourceBaseUrl: historyResourceBaseUrl.value,
    resourcePath: historyResourcePath.value,
    resourceToken: historyResourceToken.value,
  })
}

function resolveMessageAudioSource(item: any): string | null {
  return resolveHistoryMediaSource(item, {
    resourceBaseUrl: historyResourceBaseUrl.value,
    resourcePath: historyResourcePath.value,
    resourceToken: historyResourceToken.value,
  })
}

function resolveMessageVideoSource(item: any): string | null {
  return resolveHistoryMediaSource(item, {
    resourceBaseUrl: historyResourceBaseUrl.value,
    resourcePath: historyResourcePath.value,
    resourceToken: historyResourceToken.value,
  })
}

function resolveMessageFileSource(item: any): string | null {
  return resolveHistoryMediaSource(item, {
    resourceBaseUrl: historyResourceBaseUrl.value,
    resourcePath: historyResourcePath.value,
    resourceToken: historyResourceToken.value,
  })
}

function getHistoryFileSource(item: any): string | null {
  if (typeof item?.src === 'string' && item.src.trim()) {
    return item.src.trim()
  }

  return resolveMessageFileSource(item)
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
    message.warning('文件资源不可用')
    return
  }

  try {
    const result = await window.electron.window.openResource(source, getHistoryFileName(item))
    if (!result.success) {
      throw new Error(result.error || '打开文件失败')
    }
  } catch (error: any) {
    message.error(`打开文件失败: ${error.message || error}`)
  }
}

async function downloadHistoryFile(item: any) {
  const source = getHistoryFileSource(item)
  if (!source) {
    message.warning('文件资源不可用')
    return
  }

  try {
    const result = await window.electron.window.saveResource(source, getHistoryFileName(item))
    if (result.canceled) {
      return
    }
    if (!result.success) {
      throw new Error(result.error || '下载文件失败')
    }
    message.success('文件已开始保存')
  } catch (error: any) {
    message.error(`下载文件失败: ${error.message || error}`)
  }
}

function formatElement(element: any): string {
  switch (element.type) {
    case 'text':
      const textPreview = element.content?.substring(0, 15) || '文本'
      return `${textPreview}${element.content?.length > 15 ? '...' : ''}`
    case 'image':
      return '图片'
    case 'tts':
      const ttsPreview = element.text?.substring(0, 10) || '语音'
      return `${ttsPreview}${element.text?.length > 10 ? '...' : ''}`
    case 'audio':
      return '音频'
    case 'video':
      return '视频'
    case 'motion':
      return `动作: ${element.group}_${element.index}`
    case 'expression':
      return `表情: ${element.expressionId || element.id}`
    case 'wait':
      return `等待 ${element.duration}ms`
    default:
      return `${element.type}`
  }
}

function getElementIcon(type: string) {
  switch (type) {
    case 'text': return MessageSquare
    case 'image': return ImageIcon
    case 'tts':
    case 'audio': return Mic
    case 'video': return Video
    case 'motion': return Activity
    case 'expression': return Smile
    case 'wait': return Clock
    default: return HelpCircle
  }
}

function getElementTagType(type: string): 'default' | 'success' | 'info' | 'warning' | 'error' {
  switch (type) {
    case 'text':
      return 'default'
    case 'tts':
    case 'audio':
      return 'success'
    case 'image':
    case 'video':
      return 'info'
    case 'motion':
    case 'expression':
      return 'warning'
    default:
      return 'default'
  }
}

async function handleMinimizeWindow() {
  await window.electron.window.minimizeCurrent()
}

async function handleToggleWindowMaximize() {
  const result = await window.electron.window.toggleMaximizeCurrent()
  if (!result.success) {
    message.error(result.error || '切换窗口状态失败')
    return
  }
  isWindowMaximized.value = Boolean(result.maximized)
}

async function handleCloseWindow() {
  const result = await window.electron.window.closeCurrent()
  if (!result.success) {
    message.error(result.error || '关闭窗口失败')
  }
}

function handleTitleBarDoubleClick() {
  void handleToggleWindowMaximize()
}



</script>

<style scoped lang="scss">
.history-window {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(var(--color-accent-rgb), 0.1), transparent 24%),
    linear-gradient(180deg, rgba(29, 22, 19, 0.96), rgba(17, 13, 12, 1));
}

.history-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--desktop-titlebar-height);
  padding: 0 0 0 12px;
  border-bottom: 1px solid var(--desktop-panel-border);
  background: rgba(19, 15, 14, 0.92);
}

.history-titlebar__brand,
.history-titlebar__identity {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.history-titlebar__name,
.history-titlebar__view {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-titlebar__name {
  max-width: 260px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.history-titlebar__divider {
  width: 1px;
  height: 12px;
  background: var(--desktop-divider);
}

.history-titlebar__view {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.54);
}

.history-titlebar__actions {
  display: inline-flex;
  align-items: stretch;
  align-self: stretch;
}

.history-titlebar__button {
  width: 46px;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-secondary);
  transition: background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-primary);
  }

  &--close:hover {
    background: rgba(218, 82, 82, 0.88);
    color: #fff;
  }
}

.history-theme-swatch {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  display: inline-block;
  flex: 0 0 auto;
}

.history-theme-swatch--title {
  width: 10px;
  height: 10px;
}

.history-workspace {
  min-height: 0;
  flex: 1;
  display: flex;
}

.history-main {
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: var(--desktop-content-padding);
  background:
    linear-gradient(180deg, rgba(28, 22, 19, 0.7), rgba(16, 13, 12, 0.9)),
    radial-gradient(circle at top right, rgba(var(--color-accent-rgb), 0.08), transparent 28%);
}

.history-main__viewport {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--desktop-gap-md);
}

.history-overview,
.history-toolbar {
  background: rgba(255, 255, 255, 0.03);
}

.history-overview__copy {
  gap: 2px;
}

.history-overview__eyebrow {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

.history-overview__metrics {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.history-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--desktop-panel-border);
  color: var(--color-text-secondary);
  font-size: 11px;

  strong {
    color: var(--color-text-primary);
    font-weight: 600;
  }
}

.history-toolbar {
  align-items: stretch;
}

.history-view-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid var(--desktop-panel-border);
}

.history-view-switch__item {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-secondary);
  transition: background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
  }

  &--active {
    background: rgba(var(--color-accent-rgb), 0.14);
    color: var(--color-text-primary);
    box-shadow: inset 0 0 0 1px rgba(var(--color-accent-rgb), 0.18);
  }
}

.history-toolbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.history-toolbar__actions :deep(.n-input) {
  width: min(280px, 100%);
}

.history-toolbar__select {
  width: 120px;
}

.history-window :deep(.n-card) {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 28%), var(--desktop-panel-bg) !important;
  border: 1px solid var(--desktop-panel-border) !important;
  border-radius: var(--desktop-radius-panel) !important;
  box-shadow: var(--desktop-shadow) !important;
}

.history-window :deep(.n-card-header) {
  padding-bottom: 0;
}

.history-window :deep(.n-card-header__main) {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.history-grid {
  display: grid;
  gap: var(--desktop-gap-md);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
}

.history-analysis-grid {
  display: grid;
  gap: var(--desktop-gap-md);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}

.history-panel-card {
  padding: 18px;
}

.history-pagination {
  margin-top: 16px;
  justify-content: center;
}

.chart {
  width: 100%;
  height: 320px;
}

.chart-large {
  width: 100%;
  height: 420px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 14px;
  align-items: flex-start;
}

.message-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  padding-top: 4px;
}

.message-rail__icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--desktop-panel-border);
  color: var(--color-text-secondary);
}

.message-rail__label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.42);
}

.message-item--outgoing .message-rail__icon {
  background: rgba(var(--color-accent-rgb), 0.1);
  border-color: rgba(var(--color-accent-rgb), 0.16);
  color: var(--color-accent);
}

.message-item--performance .message-rail__label {
  color: var(--color-accent);
}

.message-record {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--desktop-radius-panel);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--desktop-panel-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.message-item--outgoing .message-record {
  border-color: rgba(var(--color-accent-rgb), 0.14);
  background: linear-gradient(180deg, rgba(var(--color-accent-rgb), 0.08), rgba(255, 255, 255, 0.022));
}

.message-record__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.message-record__identity {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.message-record__name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.message-record__kind {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--desktop-panel-border);
  background: rgba(255, 255, 255, 0.045);
  color: var(--color-text-secondary);
  font-size: 11px;
}

.message-record__kind--outgoing {
  border-color: rgba(var(--color-accent-rgb), 0.18);
  background: rgba(var(--color-accent-rgb), 0.12);
  color: var(--color-text-primary);
}

.message-record__kind--incoming {
  border-color: var(--desktop-panel-border);
}

.message-record__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}

.message-record__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-time {
  font-family: var(--font-mono);
}

.message-id {
  letter-spacing: 0.04em;
}

.content-item {
  margin-bottom: 8px;
}

.content-item:last-child {
  margin-bottom: 0;
}

.text-content {
  line-height: 1.6;
  font-size: 13px;
  white-space: pre-wrap;

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: 10px 0 6px;
    font-weight: 700;
    line-height: 1.3;
  }

  :deep(p) {
    margin: 4px 0;
  }

  :deep(code) {
    background: rgba(var(--color-accent-rgb), 0.12);
    border: 1px solid rgba(var(--color-accent-rgb), 0.18);
    padding: 2px 7px;
    border-radius: var(--radius-xs);
    font-family: var(--font-mono);
    font-size: 0.9em;
    color: var(--color-accent);
  }

  :deep(pre) {
    background: rgba(0, 0, 0, 0.2);
    padding: 12px;
    border-radius: var(--radius-sm);
    overflow-x: auto;
    margin: 10px 0;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  :deep(blockquote) {
    border-left: 2px solid var(--color-accent);
    margin: 8px 0;
    color: var(--color-text-secondary);
    background: rgba(var(--color-accent-rgb), 0.08);
    padding: 8px 12px;
    border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  }

  :deep(a) {
    color: var(--color-accent);
    text-decoration: none;
    border-bottom: 1px dashed rgba(var(--color-accent-rgb), 0.5);

    &:hover {
      border-bottom-style: solid;
    }
  }
}

.image-content {
  margin-top: 8px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.image-placeholder,
.media-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  color: var(--color-text-secondary);
}

.audio-content,
.video-content,
.file-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.028);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

.performance-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.performance-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--desktop-divider);
  color: var(--color-accent);
}

.performance-elements {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 4px;
}

.performance-elements :deep(.n-tag) {
  margin: 0;
  border-radius: 999px;
}

.performance-text-preview {
  margin-top: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.performance-text-preview .text-content {
  font-size: 0.9em;
}

.media-content-header,
.media-placeholder,
.file-meta,
.file-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audio-player,
.video-player {
  width: min(360px, 100%);
  max-width: 100%;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.15);
}

.video-player {
  max-height: 240px;
}

.file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  word-break: break-word;
}

.file-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-size: 12px;
  transition: background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.12);
    border-color: rgba(var(--color-accent-rgb), 0.2);
  }
}

.performance-audio-content,
.performance-video-content,
.performance-file-content,
.performance-image-content {
  margin-top: 0;
}

.performance-preview-item + .performance-preview-item {
  margin-top: 10px;
}

@media (max-width: 1080px) {
  .history-grid,
  .history-analysis-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .history-main {
    padding: 20px;
  }

  .history-overview,
  .history-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .history-overview__metrics {
    justify-content: flex-start;
  }

  .history-toolbar__actions {
    justify-content: flex-start;
  }

  .history-toolbar__actions :deep(.n-input),
  .history-toolbar__actions :deep(.n-date-picker) {
    width: 100%;
  }

  .message-item {
    grid-template-columns: 1fr;
  }

  .message-rail {
    flex-direction: row;
    align-items: center;
    padding-top: 0;
  }

  .message-record__header {
    flex-direction: column;
  }

  .message-record__meta {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .history-titlebar {
    padding-left: 10px;
  }

  .history-titlebar__divider,
  .history-titlebar__view {
    display: none;
  }

  .history-titlebar__name {
    max-width: 180px;
  }

  .history-view-switch {
    width: 100%;
    justify-content: stretch;
  }

  .history-view-switch__item {
    flex: 1 1 0;
    justify-content: center;
  }
}
</style>
