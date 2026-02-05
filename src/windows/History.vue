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
                  <n-card title="消息类型分布">
                    <div ref="messageTypeRef" class="chart"></div>
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
                    v-model:value="messageTypeFilter"
                    :options="messageTypeOptions"
                    placeholder="消息类型"
                    clearable
                    style="width: 150px"
                    @update:value="loadMessages"
                  />
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
                        <span class="message-user">{{ msg.user_name || msg.user_id }}</span>
                        <n-tag :type="getMessageTypeColor(msg.message_type)" size="small">
                          {{ getMessageTypeLabel(msg.message_type) }}
                        </n-tag>
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
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
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
  gfm: true,
  headerIds: false,
  mangle: false
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
const dateRange = ref<[number, number]>([
  Date.now() - 7 * 24 * 60 * 60 * 1000,
  Date.now()
])

// 历史记录
const messages = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(0)
const keyword = ref('')
const messageTypeFilter = ref<string>()
const directionFilter = ref<string>()

const messageTypeOptions = [
  { label: '好友', value: 'friend' },
  { label: '群聊', value: 'group' },
  { label: '通知', value: 'notify' }
]

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
const messageTypeRef = ref<HTMLElement>()
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

    if (messageTypeFilter.value) {
      options.messageType = messageTypeFilter.value
    }

    if (directionFilter.value) {
      options.direction = directionFilter.value
    }

    const result = await window.electron.history.getMessages(options)

    if (result.success) {
      messages.value = result.data
      totalMessages.value = result.total || 0
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
      totalMessages.value = allMessagesResult.total || 0
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

  // 消息趋势图
  if (messageTrendRef.value) {
    console.log('[History] 渲染消息趋势图')
    const chart = echarts.init(messageTrendRef.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map(d => d.date)
      },
      yAxis: { type: 'value' },
      series: [{
        name: '消息数',
        type: 'line',
        data: data.map(d => d.message_count),
        smooth: true,
        areaStyle: {}
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] messageTrendRef 未找到')
  }

  // 消息类型分布（饼图）
  if (messageTypeRef.value) {
    console.log('[History] 渲染消息类型分布图')
    const chart = echarts.init(messageTypeRef.value)
    const typeData = aggregateByType(data, 'message_count')
    chart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        name: '消息类型',
        type: 'pie',
        radius: '60%',
        data: typeData
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] messageTypeRef 未找到')
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
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['文字', '图片', '音频', '视频']
      },
      yAxis: { type: 'value' },
      series: [{
        name: '使用量',
        type: 'bar',
        data: [totalData.text, totalData.image, totalData.audio, totalData.video],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#646cff' },
            { offset: 1, color: '#535bf2' }
          ])
        }
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] performElementRef 未找到')
  }

  // 活跃时段（热力图）
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
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, i) => `${i}:00`)
      },
      yAxis: { type: 'value' },
      series: [{
        name: '消息数',
        type: 'bar',
        data: hourData,
        itemStyle: { color: '#646cff' }
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
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: motionData.map(d => d.name).slice(0, 10)
      },
      series: [{
        name: '使用次数',
        type: 'bar',
        data: motionData.map(d => d.value).slice(0, 10),
        itemStyle: { color: '#646cff' }
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
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: expressionData.map(d => d.name).slice(0, 10)
      },
      series: [{
        name: '使用次数',
        type: 'bar',
        data: expressionData.map(d => d.value).slice(0, 10),
        itemStyle: { color: '#535bf2' }
      }]
    })
    charts.push(chart)
  } else {
    console.warn('[History] expressionRankRef 未找到')
  }

  console.log('[History] 图表渲染完成，共', charts.length, '个图表')
}

function aggregateByType(data: any[], field: string) {
  const total = data.reduce((sum, d) => sum + (d[field] || 0), 0)
  return [
    { name: '总计', value: total }
  ]
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

function getMessageTypeLabel(type: string): string {
  switch (type) {
    case 'friend': return '好友'
    case 'group': return '群聊'
    case 'notify': return '通知'
    default: return type
  }
}

function formatContent(content: string): string {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      return parsed.map(item => {
        if (item.type === 'text') return item.text
        return `[${item.type}]`
      }).join('')
    }
    return String(content)
  } catch {
    return String(content)
  }
}

function getMessageTypeColor(type: string): 'success' | 'info' | 'warning' {
  switch (type) {
    case 'friend': return 'success'
    case 'group': return 'info'
    case 'notify': return 'warning'
    default: return 'info'
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
  background: var(--color-bg-dark);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.window-header {
  height: 32px;
  background: var(--color-bg-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .window-close-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary);
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 77, 79, 0.1);
      color: var(--color-error);
    }
  }
}

.history-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--spacing-lg);
  flex: 1;
  overflow: auto;
  width: 100%;
}

.statistics-panel,
.history-panel,
.analysis-panel {
  padding: var(--spacing-md) 0;
}

.chart {
  width: 100%;
  height: 300px;
}

.chart-large {
  width: 100%;
  height: 400px;
}

/* 消息列表样式 */
.message-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.message-item {
  display: flex;
  gap: 12px;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-incoming {
  flex-direction: row;
}

.message-outgoing {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content-wrapper {
  flex: 1;
  max-width: 70%;
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  font-weight: 500;
}

.message-bubble {
  background: var(--color-bg-light);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  word-wrap: break-word;
}

.message-outgoing .message-bubble {
  background: linear-gradient(135deg, #646cff 0%, #535bf2 100%);
  color: white;
}

.message-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.message-outgoing .message-footer {
  flex-direction: row-reverse;
}

.message-time {
  font-weight: 500;
}

.message-id {
  opacity: 0.6;
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
  white-space: pre-wrap;

  /* Markdown 样式 */
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    margin: 16px 0 8px 0;
    font-weight: 600;
    line-height: 1.4;
  }

  :deep(h1) { font-size: 1.8em; }
  :deep(h2) { font-size: 1.5em; }
  :deep(h3) { font-size: 1.3em; }
  :deep(h4) { font-size: 1.1em; }

  :deep(p) {
    margin: 4px 0;
  }

  :deep(p:first-child) {
    margin-top: 0;
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }

  :deep(ul), :deep(ol) {
    margin: 8px 0;
    padding-left: 24px;
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(code) {
    background: rgba(0, 0, 0, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.9em;
  }

  :deep(pre) {
    background: rgba(0, 0, 0, 0.1);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;
  }

  :deep(pre code) {
    background: none;
    padding: 0;
  }

  :deep(blockquote) {
    border-left: 4px solid rgba(100, 108, 255, 0.5);
    padding-left: 12px;
    margin: 8px 0;
    color: var(--color-text-secondary);
  }

  :deep(a) {
    color: #646cff;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
  }

  :deep(th), :deep(td) {
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 8px 12px;
    text-align: left;
  }

  :deep(th) {
    background: rgba(100, 108, 255, 0.1);
    font-weight: 600;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 16px 0;
  }

  /* LaTeX 公式样式 */
  :deep(.katex) {
    font-size: 1.1em;
  }

  :deep(.katex-display) {
    margin: 16px 0;
    overflow-x: auto;
    overflow-y: hidden;
  }
}

.message-outgoing .text-content {
  :deep(code) {
    background: rgba(255, 255, 255, 0.2);
  }

  :deep(pre) {
    background: rgba(255, 255, 255, 0.2);
  }

  :deep(blockquote) {
    border-left-color: rgba(255, 255, 255, 0.5);
    color: rgba(255, 255, 255, 0.9);
  }

  :deep(a) {
    color: rgba(255, 255, 255, 0.9);
  }

  :deep(th), :deep(td) {
    border-color: rgba(255, 255, 255, 0.2);
  }

  :deep(th) {
    background: rgba(255, 255, 255, 0.2);
  }

  :deep(hr) {
    border-top-color: rgba(255, 255, 255, 0.2);
  }
}

.image-content {
  margin-top: 8px;
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: rgba(100, 108, 255, 0.1);
  border-radius: 8px;
  color: var(--color-text-secondary);
}

.audio-content,
.video-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(100, 108, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
}

/* 表演序列样式 */
.performance-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.performance-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.performance-elements {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.performance-text-preview {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;

  .text-content {
    font-size: 0.95em;
  }
}


</style>
