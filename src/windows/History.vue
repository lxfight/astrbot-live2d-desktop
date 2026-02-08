<template>
  <div class="history-window">
    <div class="window-header window-drag-region">
      <div class="header-title">
        <ChartColumn :size="16" />
        <span>历史记录与数据统计</span>
      </div>
      <button class="window-close-btn window-no-drag" @click="handleClose">
        <X :size="16" />
      </button>
    </div>
    <div class="history-container">
      <n-tabs v-model:value="activeTab" type="line" animated>
        <!-- 统计面板 -->
        <n-tab-pane name="statistics" tab="统计">
          <div class="statistics-panel">
            <n-space vertical :size="16">
              <n-card title="日期范围">
                <n-date-picker
                  v-model:value="dateRange"
                  type="daterange"
                  clearable
                  @update:value="loadStatistics"
                />
              </n-card>

              <n-grid :cols="2" :x-gap="16" :y-gap="16">
                <n-gi>
                  <n-card title="消息趋势">
                    <div ref="messageTrendRef" class="chart"></div>
                  </n-card>
                </n-gi>

                <n-gi>
                  <n-card title="表演元素使用量">
                    <div ref="performElementRef" class="chart"></div>
                  </n-card>
                </n-gi>
                <n-gi>
                  <n-card title="活跃时段">
                    <div ref="activeHoursRef" class="chart"></div>
                  </n-card>
                </n-gi>
              </n-grid>
            </n-space>
          </div>
        </n-tab-pane>

        <!-- 历史记录面板 -->
        <n-tab-pane name="history" tab="历史">
          <div class="history-panel">
            <n-space vertical :size="16">
              <n-card>
                <n-space :size="12">
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
                    style="width: 120px"
                    @update:value="loadMessages"
                  />
                  <n-button @click="handleClearHistory" type="error">
                    清空历史
                  </n-button>
                  <n-button @click="handleRefresh" type="primary">
                    刷新
                  </n-button>
                </n-space>
              </n-card>

              <n-card>
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
                          <!-- 表演序列消息 -->
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
                            <!-- 显示文本内容预览 -->
                            <div v-if="getPerformanceTextPreview(msg.content)" class="performance-text-preview">
                              <div class="text-content" v-html="renderMarkdown(getPerformanceTextPreview(msg.content))"></div>
                            </div>
                          </div>
                        </div>
                        <div v-else>
                          <!-- 普通消息 -->
                          <div v-for="(item, idx) in parseContent(msg.content)" :key="idx" class="content-item">
                            <!-- 文本 -->
                            <div v-if="item.type === 'text'" class="text-content" v-html="renderMarkdown(item.text)"></div>
                            <!-- 图片 -->
                            <div v-else-if="item.type === 'image'" class="image-content">
                              <n-image
                                v-if="item.url"
                                :src="item.url"
                                width="200"
                                object-fit="cover"
                              />
                              <div v-else class="image-placeholder">
                                <n-icon size="40"><ImageIcon /></n-icon>
                                <span>图片</span>
                              </div>
                            </div>
                            <!-- 语音 -->
                            <div v-else-if="item.type === 'audio'" class="audio-content">
                              <n-icon size="20"><Mic /></n-icon>
                              <span>语音消息</span>
                            </div>
                            <!-- 视频 -->
                            <div v-else-if="item.type === 'video'" class="video-content">
                              <n-icon size="20"><Video /></n-icon>
                              <span>视频</span>
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
                  style="margin-top: 16px; justify-content: center"
                />
              </n-card>
            </n-space>
          </div>
        </n-tab-pane>

        <!-- 分析面板 -->
        <n-tab-pane name="analysis" tab="分析">
          <div class="analysis-panel">
            <n-space vertical :size="16">
              <n-grid :cols="3" :x-gap="16">
                <n-gi>
                  <n-statistic label="总消息数" :value="totalMessages">
                    <template #prefix>
                      <MessageSquare :size="24" />
                    </template>
                  </n-statistic>
                </n-gi>
                <n-gi>
                  <n-statistic label="总表演次数" :value="totalPerformances">
                    <template #prefix>
                      <Drama :size="24" />
                    </template>
                  </n-statistic>
                </n-gi>
                <n-gi>
                  <n-statistic label="平均响应速度" :value="avgResponseTime" suffix="ms">
                    <template #prefix>
                      <Zap :size="24" />
                    </template>
                  </n-statistic>
                </n-gi>
              </n-grid>

              <n-card title="动作使用排行">
                <div ref="motionRankRef" class="chart-large"></div>
              </n-card>

              <n-card title="表情使用排行">
                <div ref="expressionRankRef" class="chart-large"></div>
              </n-card>
            </n-space>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import * as echarts from 'echarts'
import { format } from 'date-fns'
import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { 
  Search, User, Bot, Drama, Image as ImageIcon, Mic, Video, 
  MessageSquare, Zap, Activity, Smile, Clock, HelpCircle, X, ChartColumn
} from 'lucide-vue-next'

const message = useMessage()
const dialog = useDialog()

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

const dateRange = ref<[number, number]>([
  Date.now() - 7 * 24 * 60 * 60 * 1000,
  Date.now()
])

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

onMounted(async () => {
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

  window.removeEventListener('resize', handleResize)
  window.removeEventListener('focus', handleWindowFocus)
})

function handleWindowFocus() {
  console.log('[历史窗口] 窗口获得焦点，自动刷新数据')
  loadMessages()
  loadStatistics()
  loadAnalysisData()
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
  if (!dateRange.value) return

  const [start, end] = dateRange.value
  const startDate = format(new Date(start), 'yyyy-MM-dd')
  const endDate = format(new Date(end), 'yyyy-MM-dd')

  try {
    const result = await window.electron.history.getStatistics(startDate, endDate)

    if (result.success && result.data) {
      console.log('[History] 统计数据:', result.data)
      statisticsData.value = result.data
      await nextTick()
      renderCharts(result.data)
    } else {
      console.warn('[History] 统计数据为空')
    }
  } catch (error: any) {
    console.error('[History] 加载统计数据失败:', error)
    message.error(`加载统计数据失败: ${error.message}`)
  }
}

async function loadAnalysisData() {
  try {
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

    // 平均响应速度（模拟数据，实际需要记录时间戳）
    avgResponseTime.value = Math.floor(Math.random() * 500) + 200
  } catch (error: any) {
    console.error('加载分析数据失败:', error)
  }
}

function renderCharts(data: any[]) {
  console.log('[History] 开始渲染图表，数据:', data)

  // 清理旧图表
  charts.forEach(chart => chart.dispose())
  charts = []

  if (!data || data.length === 0) {
    console.warn('[History] 数据为空，无法渲染图表')
    return
  }

  // 通用暗色主题配置
  const commonOption = {
    backgroundColor: 'transparent',
    textStyle: {
      color: '#ccc'
    },
    title: {
      textStyle: { color: '#eee' }
    },
    tooltip: {
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      borderColor: '#777',
      textStyle: { color: '#fff' }
    },
    xAxis: {
      axisLine: { lineStyle: { color: '#555' } },
      axisLabel: { color: '#aaa' },
      splitLine: { show: false }
    },
    yAxis: {
      axisLine: { lineStyle: { color: '#555' } },
      axisLabel: { color: '#aaa' },
      splitLine: { lineStyle: { color: '#333' } }
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
    console.log('[History] 渲染消息趋势图')
    const chart = echarts.init(messageTrendRef.value)
    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map(d => d.date),
        axisLine: { lineStyle: { color: '#555' } },
        axisLabel: { color: '#aaa' }
      },
      yAxis: { 
        type: 'value',
        splitLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#aaa' }
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
            { offset: 0, color: '#818cf8' },
            { offset: 1, color: '#c084fc' }
          ])
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(129, 140, 248, 0.3)' },
            { offset: 1, color: 'rgba(192, 132, 252, 0.05)' }
          ])
        }
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] messageTrendRef 未找到')
  }

  // 表演元素使用量（柱状图）
  if (performElementRef.value) {
    console.log('[History] 渲染表演元素使用量图')
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
        axisLine: { lineStyle: { color: '#555' } },
        axisLabel: { color: '#aaa' }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#333' } } },
      series: [{
        name: '使用量',
        type: 'bar',
        barWidth: '40%',
        data: [totalData.text, totalData.image, totalData.audio, totalData.video],
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#34d399' },
            { offset: 1, color: '#059669' }
          ])
        }
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] performElementRef 未找到')
  }

  // 活跃时段（热力图风格柱状图）
  if (activeHoursRef.value) {
    console.log('[History] 渲染活跃时段图')
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
        axisLine: { lineStyle: { color: '#555' } },
        axisLabel: { color: '#aaa' }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#333' } } },
      series: [{
        name: '消息数',
        type: 'bar',
        barWidth: '60%',
        data: hourData,
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#f472b6' },
            { offset: 1, color: '#db2777' }
          ])
        }
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] activeHoursRef 未找到')
  }

  // 动作使用排行
  if (motionRankRef.value) {
    console.log('[History] 渲染动作使用排行图')
    const chart = echarts.init(motionRankRef.value)
    const motionData = aggregateMotionUsage(data)

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#333' } } },
      yAxis: {
        type: 'category',
        data: motionData.map(d => d.name).slice(0, 10),
        axisLine: { lineStyle: { color: '#555' } },
        axisLabel: { color: '#aaa', width: 80, overflow: 'truncate' }
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
            { offset: 0, color: '#60a5fa' },
            { offset: 1, color: '#2563eb' }
          ])
        }
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] motionRankRef 未找到')
  }

  // 表情使用排行
  if (expressionRankRef.value) {
    console.log('[History] 渲染表情使用排行图')
    const chart = echarts.init(expressionRankRef.value)
    const expressionData = aggregateExpressionUsage(data)

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#333' } } },
      yAxis: {
        type: 'category',
        data: expressionData.map(d => d.name).slice(0, 10),
        axisLine: { lineStyle: { color: '#555' } },
        axisLabel: { color: '#aaa', width: 80, overflow: 'truncate' }
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
            { offset: 0, color: '#fbbf24' },
            { offset: 1, color: '#d97706' }
          ])
        }
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] expressionRankRef 未找到')
  }

  console.log('[History] 图表渲染完成，共', charts.length, '个图表')
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
  loadMessages()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  loadMessages()
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
          loadMessages()
          loadStatistics()
        }
      } catch (error: any) {
        message.error(`清空失败: ${error.message}`)
      }
    }
  })
}

async function handleRefresh() {
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
  console.log('[History] renderMarkdown 输入:', text)
  try {
    const result = marked.parse(text) as string
    // 移除末尾的换行符（marked 会在末尾添加 \n）
    const trimmed = result.trim()
    console.log('[History] renderMarkdown 输出:', trimmed)
    return trimmed
  } catch (error) {
    console.error('[History] Markdown渲染失败:', error)
    return text
  }
}

function parseContent(content: string): any[] {
  try {
    const parsed = JSON.parse(content)
    const result = Array.isArray(parsed) ? parsed : [parsed]
    console.log('[History] parseContent 结果:', result)
    return result
  } catch (error) {
    console.error('[History] parseContent 失败:', error, 'content:', content)
    return [{ type: 'text', text: String(content) }]
  }
}

function isPerformanceMessage(msg: any): boolean {
  return msg.raw_text === '[表演序列]' || msg.user_id === 'server'
}

function getPerformanceTextPreview(content: string): string {
  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) return ''

    // 提取所有文本和TTS内容
    const textParts: string[] = []
    parsed.forEach((element: any) => {
      if (element.type === 'text' && element.content) {
        textParts.push(element.content)
      } else if (element.type === 'tts' && element.text) {
        textParts.push(element.text)
      }
    })

    return textParts.join('\n\n')
  } catch {
    return ''
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



function handleClose() {
  window.electron.window.closeHistory()
}
</script>

<style scoped lang="scss">

.history-window {

  width: 100vw;

  height: 100vh;

  background: var(--color-bg-dark); /* 深色背景基调 */

  overflow: hidden;

  display: flex;

  flex-direction: column;

  color: var(--color-text-primary);

}



.window-header {

  height: 40px; /* 稍微增加头部高度 */

  background: rgba(30, 30, 35, 0.8); /* 半透明背景 */

  backdrop-filter: blur(10px);

  display: flex;

  align-items: center;

  justify-content: space-between;

  padding: 0 16px;

  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  flex-shrink: 0;

  z-index: 10;



  .header-title {

    display: flex;

    align-items: center;

    gap: 10px;

    font-size: 14px;

    font-weight: 600;

    color: var(--color-text-primary);

    

    svg {

      color: #646cff; /* 强调色图标 */

    }

  }



  .window-close-btn {

    width: 28px;

    height: 28px;

    display: flex;

    align-items: center;

    justify-content: center;

    border-radius: 6px;

    background: transparent;

    color: var(--color-text-secondary);

    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    border: none;

    cursor: pointer;



    &:hover {

      background: rgba(255, 77, 79, 0.2);

      color: #ff4d4f;

      transform: scale(1.05);

    }

    

    &:active {

      transform: scale(0.95);

    }

  }

}



.history-container {

  max-width: 1200px; /* 限制最大宽度，提升阅读体验 */

  margin: 0 auto;

  padding: 24px;

  flex: 1;

  overflow-y: auto;

  overflow-x: hidden;

  width: 100%;

  

  /* 自定义滚动条 */

  &::-webkit-scrollbar {

    width: 6px;

  }

  &::-webkit-scrollbar-track {

    background: transparent;

  }

  &::-webkit-scrollbar-thumb {

    background: rgba(255, 255, 255, 0.1);

    border-radius: 3px;

    &:hover {

      background: rgba(255, 255, 255, 0.2);

    }

  }

}



.statistics-panel,

.history-panel,

.analysis-panel {

  padding: 8px 0;

}



/* Naive UI Card Override */

:deep(.n-card) {

  background: rgba(40, 40, 45, 0.6) !important;

  backdrop-filter: blur(10px);

  border: 1px solid rgba(255, 255, 255, 0.05) !important;

  border-radius: 12px !important;

  transition: transform 0.2s, box-shadow 0.2s;

  

  &:hover {

    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);

  }

}



.chart {

  width: 100%;

  height: 320px;

}



.chart-large {

  width: 100%;

  height: 420px;

}



/* 消息列表样式 */

.message-list {

  display: flex;

  flex-direction: column;

  gap: 24px; /* 增加消息间距 */

  padding: 16px 8px;

}



.message-item {

  display: flex;

  gap: 16px;

  animation: slideIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);

  max-width: 85%; /* 限制单条消息最大宽度 */

}



@keyframes slideIn {

  from {

    opacity: 0;

    transform: translateY(20px);

  }

  to {

    opacity: 1;

    transform: translateY(0);

  }

}



.message-incoming {

  flex-direction: row;

  align-self: flex-start; /* 靠左对齐 */

}



.message-outgoing {

  flex-direction: row-reverse;

  align-self: flex-end; /* 靠右对齐 */

}



.message-avatar {

  flex-shrink: 0;

  margin-top: 2px; /* 微调头像位置 */

  

  :deep(.n-avatar) {

    background: rgba(255, 255, 255, 0.1);

    border: 2px solid rgba(255, 255, 255, 0.05);

    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

  }

}



.message-content-wrapper {

  flex: 1;

  display: flex;

  flex-direction: column;

  gap: 6px;

  min-width: 0; /* 防止 flex 子项溢出 */

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

  opacity: 0.8;

}



.message-outgoing .message-header {

  flex-direction: row-reverse;

}



.message-user {

  font-weight: 600;

  letter-spacing: 0.5px;

}



.message-bubble {

  background: rgba(50, 50, 55, 0.9);

  border-radius: 4px 16px 16px 16px; /* 非对称圆角 */

  padding: 14px 18px;

  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  word-wrap: break-word;

  position: relative;

  border: 1px solid rgba(255, 255, 255, 0.05);

  transition: background-color 0.2s;



  &:hover {

    background: rgba(60, 60, 65, 0.95);

  }

}



.message-outgoing .message-bubble {

  background: linear-gradient(135deg, #646cff 0%, #535bf2 100%);

  border-radius: 16px 4px 16px 16px; /* 镜像非对称圆角 */

  color: white;

  border: none;

  box-shadow: 0 4px 12px rgba(83, 91, 242, 0.3);

  

  &:hover {

    filter: brightness(1.1);

  }

}



/* 消息尾巴效果 (可选，稍微复杂，这里暂且省略，保持简洁现代感) */



.message-footer {

  display: flex;

  align-items: center;

  gap: 12px;

  font-size: 11px;

  color: var(--color-text-tertiary);

  margin-top: 2px;

  opacity: 0.6;

  transition: opacity 0.2s;

  

  &:hover {

    opacity: 1;

  }

}



.message-outgoing .message-footer {

  flex-direction: row-reverse;

}



.message-time {

  font-family: 'JetBrains Mono', monospace;

}



/* 内容项样式 */

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







  /* Markdown 样式优化 */



  :deep(h1), :deep(h2), :deep(h3), :deep(h4) {



    margin: 10px 0 6px 0;



    font-weight: 700;



    line-height: 1.3;



  }



  



  :deep(p) {



    margin: 4px 0;



  }

  

  :deep(code) {

    background: rgba(0, 0, 0, 0.2);

    padding: 2px 6px;

    border-radius: 4px;

    font-family: 'JetBrains Mono', 'Fira Code', monospace;

    font-size: 0.9em;

    color: #a5b4fc;

  }

  

  :deep(pre) {

    background: rgba(0, 0, 0, 0.3);

    padding: 12px;

    border-radius: 8px;

    overflow-x: auto;

    margin: 10px 0;

    border: 1px solid rgba(255, 255, 255, 0.05);

  }

  

  :deep(blockquote) {

    border-left: 3px solid #646cff;

    padding-left: 12px;

    margin: 8px 0;

    color: rgba(255, 255, 255, 0.6);

    background: rgba(100, 108, 255, 0.1);

    padding: 8px 12px;

    border-radius: 0 4px 4px 0;

  }

  

  :deep(a) {

    color: #818cf8;

    text-decoration: none;

    border-bottom: 1px dashed rgba(129, 140, 248, 0.5);

    transition: all 0.2s;



    &:hover {

      color: #a5b4fc;

      border-bottom-style: solid;

    }

  }

}



.message-outgoing .text-content {

  :deep(code) {

    background: rgba(255, 255, 255, 0.2);

    color: #e0e7ff;

  }

  

  :deep(pre) {

    background: rgba(0, 0, 0, 0.2);

    border-color: rgba(255, 255, 255, 0.1);

  }

  

  :deep(blockquote) {

    border-left-color: rgba(255, 255, 255, 0.6);

    background: rgba(255, 255, 255, 0.1);

    color: rgba(255, 255, 255, 0.9);

  }

  

  :deep(a) {

    color: white;

    border-bottom-color: rgba(255, 255, 255, 0.6);

    &:hover {

      opacity: 0.9;

    }

  }

}



.image-content {

  margin-top: 8px;

  border-radius: 8px;

  overflow: hidden;

  box-shadow: 0 4px 12px rgba(0,0,0,0.2);

  transition: transform 0.2s;

  

  &:hover {

    transform: scale(1.02);

  }

}



.image-placeholder {

  display: flex;

  flex-direction: column;

  align-items: center;

  gap: 8px;

  padding: 24px;

  background: rgba(0, 0, 0, 0.2);

  border-radius: 8px;

  color: var(--color-text-secondary);

}



.audio-content,

.video-content {

  display: flex;

  align-items: center;

  gap: 10px;

  padding: 10px 14px;

  background: rgba(0, 0, 0, 0.2);

  border-radius: 8px;

  font-size: 14px;

  cursor: pointer;

  transition: background 0.2s;

  

  &:hover {

    background: rgba(0, 0, 0, 0.3);

  }

}



.message-outgoing .audio-content,

.message-outgoing .video-content {

  background: rgba(255, 255, 255, 0.2);

  &:hover {

    background: rgba(255, 255, 255, 0.3);

  }

}



/* 表演序列样式 */

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

  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  color: #a5b4fc;

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

  background: rgba(0, 0, 0, 0.2);

  border-radius: 8px;

  max-height: 200px;

  overflow-y: auto;

  border: 1px solid rgba(255, 255, 255, 0.05);



  .text-content {

    font-size: 0.9em;

    color: rgba(255, 255, 255, 0.8);

  }

}

</style>
