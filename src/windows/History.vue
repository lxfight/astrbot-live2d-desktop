<template>
  <div class="history-page">
    <header class="history-page__header">
      <div class="history-page__title">
        <span class="history-page__eyebrow">AstrBot Live2D Desktop</span>
        <h1>历史记录</h1>
        <p>时间线、统计图表和动作分析统一收进一个原生工具窗口。</p>
      </div>

      <div class="history-page__meta">
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
    </header>

    <div class="section-stack history-page__content">
      <section class="panel-card history-toolbar">
        <div class="history-toolbar__copy">
          <h2>{{ activeTabLabel }}</h2>
          <p>{{ activeTabDescription }}</p>
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

      <n-tabs v-model:value="activeTab" type="line" animated class="history-tabs">
        <n-tab-pane name="statistics" tab="统计">
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
        </n-tab-pane>

        <n-tab-pane name="history" tab="历史">
          <n-card class="history-panel-card">
            <div class="message-list">
              <div
                v-for="msg in messages"
                :key="msg.id"
                :class="['message-item', msg.direction === 'outgoing' ? 'message-outgoing' : 'message-incoming']"
              >
                <div class="message-avatar">
                  <n-avatar :size="40">
                    <component :is="msg.direction === 'outgoing' ? User : Bot" :size="24" />
                  </n-avatar>
                </div>
                <div class="message-content-wrapper">
                  <div class="message-header">
                    <span class="message-user">
                      {{
                        msg.direction === 'incoming'
                          ? (msg.user_id === 'server' || msg.user_id === 'bot' ? 'AstrBot' : (msg.user_name || msg.user_id))
                          : (msg.user_name || '我')
                      }}
                    </span>
                  </div>
                  <div class="message-bubble">
                    <div v-if="msg.direction === 'incoming' && isPerformanceMessage(msg)">
                      <div class="performance-content">
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
                            style="margin: 2px"
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
                  <div class="message-footer">
                    <span class="message-time">{{ formatTimestamp(msg.timestamp) }}</span>
                    <span class="message-id">ID: {{ msg.message_id }}</span>
                  </div>
                </div>
              </div>
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
          </n-card>
        </n-tab-pane>

        <n-tab-pane name="analysis" tab="分析">
          <div class="section-grid history-analysis-grid">
            <n-card title="动作使用排行">
              <div ref="motionRankRef" class="chart-large"></div>
            </n-card>

            <n-card title="表情使用排行">
              <div ref="expressionRankRef" class="chart-large"></div>
            </n-card>
          </div>
        </n-tab-pane>
      </n-tabs>
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
  FileText, ExternalLink, Download
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
const activeTabLabel = computed(() => {
  if (activeTab.value === 'history') return '消息时间线'
  if (activeTab.value === 'analysis') return '动作与表情分析'
  return '统计概览'
})
const activeTabDescription = computed(() => {
  if (activeTab.value === 'history') {
    return '按时间回看对话和表演内容，支持搜索、方向过滤和媒体资源回放。'
  }
  if (activeTab.value === 'analysis') {
    return '用主题一致的图表看动作和表情的使用分布，不再混搭固定蓝黄紫。'
  }
  return '查看消息趋势、表演元素总量和活跃时段。'
})
const themeSwatchStyle = computed(() => ({
  background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
  boxShadow: `0 12px 24px ${palette.value.shadowColor}`,
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
  await syncHistoryResourceConfig()
  await loadMessages()
  await loadStatistics()
  await loadAnalysisData()

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



</script>

<style scoped lang="scss">
.history-page {
  min-height: 100vh;
  padding: 24px;
  overflow-y: auto;
  background:
    radial-gradient(circle at top right, rgba(var(--color-accent-rgb), 0.12), transparent 24%),
    linear-gradient(180deg, var(--color-bg-light), var(--color-bg-dark) 40%);
}

.history-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.history-page__title {
  display: flex;
  flex-direction: column;
  gap: 6px;

  h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.05em;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
  }
}

.history-page__eyebrow {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

.history-page__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.history-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 8px 12px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary);

  strong {
    color: var(--color-text-primary);
    font-weight: 600;
  }
}

.history-page__content {
  padding-top: 20px;
}

.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.04);
}

.history-toolbar__copy {
  display: flex;
  flex-direction: column;
  gap: 6px;

  h2 {
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.04em;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
  }
}

.history-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.history-toolbar__actions :deep(.n-input) {
  width: min(280px, 100%);
}

.history-toolbar__select {
  width: 120px;
}

.history-theme-swatch {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-block;
}

.history-tabs :deep(.n-tabs-nav) {
  margin-bottom: 18px;
}

:deep(.n-tabs-tab-pad) {
  display: none !important;
}

:deep(.n-tabs-nav-scroll-content) {
  gap: 6px;
}

:deep(.n-tabs-tab) {
  min-width: 96px;
  justify-content: center;
  padding: 10px 14px !important;
  border-radius: 14px 14px 0 0;
}

:deep(.n-card) {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: 22px !important;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(18px);
}

.history-grid,
.history-analysis-grid {
  align-items: stretch;
}

.history-panel-card {
  padding: 16px 10px 10px;
}

.history-pagination {
  margin-top: 18px;
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
  gap: 24px;
  padding: 6px 10px;
}

.message-item {
  display: flex;
  gap: 16px;
  animation: history-slide-in 0.35s var(--ease-out);
  max-width: 85%;
}

@keyframes history-slide-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-incoming {
  flex-direction: row;
  align-self: flex-start;
}

.message-outgoing {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.message-avatar {
  flex-shrink: 0;
  margin-top: 2px;

  :deep(.n-avatar) {
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
}

.message-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.message-outgoing .message-content-wrapper {
  align-items: flex-end;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.message-outgoing .message-header {
  flex-direction: row-reverse;
}

.message-user {
  font-weight: 600;
  letter-spacing: 0.05em;
}

.message-bubble {
  position: relative;
  padding: 14px 18px;
  border-radius: 10px var(--radius-lg) var(--radius-lg) var(--radius-lg);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xs);
  word-wrap: break-word;
  transition: background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(var(--color-accent-rgb), 0.16);
  }
}

.message-outgoing .message-bubble {
  border-radius: var(--radius-lg) 10px var(--radius-lg) var(--radius-lg);
  background: linear-gradient(135deg, rgba(var(--color-accent-rgb), 0.94), rgba(var(--color-accent-rgb), 0.72));
  color: var(--theme-accent-contrast);
  border-color: transparent;
  box-shadow: 0 12px 28px rgba(var(--color-accent-rgb), 0.24);
}

.message-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  opacity: 0.72;
}

.message-outgoing .message-footer {
  flex-direction: row-reverse;
}

.message-time {
  font-family: var(--font-mono);
}

.content-item {
  margin-bottom: 8px;
}

.content-item:last-child {
  margin-bottom: 0;
}

.text-content {
  line-height: 1.6;
  font-size: 14px;
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
    background: rgba(0, 0, 0, 0.22);
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

.message-outgoing .text-content {
  :deep(code) {
    background: rgba(255, 255, 255, 0.18);
    color: inherit;
  }

  :deep(pre) {
    background: rgba(0, 0, 0, 0.18);
    border-color: rgba(255, 255, 255, 0.08);
  }

  :deep(blockquote) {
    border-left-color: rgba(255, 255, 255, 0.56);
    background: rgba(255, 255, 255, 0.12);
    color: inherit;
  }

  :deep(a) {
    color: inherit;
    border-bottom-color: rgba(255, 255, 255, 0.56);
  }
}

.image-content {
  margin-top: 8px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.image-placeholder,
.media-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  background: rgba(0, 0, 0, 0.16);
  border-radius: 10px;
  color: var(--color-text-secondary);
}

.audio-content,
.video-content,
.file-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.16);
  border-radius: 10px;
}

.message-outgoing .audio-content,
.message-outgoing .video-content,
.message-outgoing .file-content {
  background: rgba(255, 255, 255, 0.16);
}

.performance-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 280px;
}

.performance-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-accent);
}

.performance-elements {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 4px;
}

.performance-text-preview {
  margin-top: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.16);
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
  width: min(320px, 100%);
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
  background: rgba(255, 255, 255, 0.08);
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

@media (max-width: 960px) {
  .history-page {
    padding: 18px;
  }

  .history-page__header {
    flex-direction: column;
  }

  .history-page__meta {
    justify-content: flex-start;
  }

  .history-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .history-toolbar__actions {
    width: 100%;
  }

  .history-toolbar__actions :deep(.n-input),
  .history-toolbar__actions :deep(.n-date-picker) {
    width: 100%;
  }

  .message-item {
    max-width: 100%;
  }
}
</style>
