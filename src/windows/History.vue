<template>
  <div class="history-window">
    <div class="history-container">
      <h1>历史记录与数据统计</h1>
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
                      <span>🔍</span>
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
                </n-space>
              </n-card>

              <n-card>
                <n-list bordered>
                  <n-list-item v-for="msg in messages" :key="msg.id">
                    <n-thing>
                      <template #avatar>
                        <n-avatar>{{ msg.direction === 'input' ? '👤' : '🤖' }}</n-avatar>
                      </template>
                      <template #header>
                        {{ msg.user_name || msg.user_id }}
                        <n-tag :type="getMessageTypeColor(msg.message_type)" size="small" style="margin-left: 8px">
                          {{ msg.message_type }}
                        </n-tag>
                      </template>
                      <template #header-extra>
                        {{ formatTimestamp(msg.timestamp) }}
                      </template>
                      <template #description>
                        {{ msg.raw_text || formatContent(msg.content) }}
                      </template>
                    </n-thing>
                  </n-list-item>
                </n-list>

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
                      <span style="font-size: 24px">💬</span>
                    </template>
                  </n-statistic>
                </n-gi>
                <n-gi>
                  <n-statistic label="总表演次数" :value="totalPerformances">
                    <template #prefix>
                      <span style="font-size: 24px">🎭</span>
                    </template>
                  </n-statistic>
                </n-gi>
                <n-gi>
                  <n-statistic label="平均响应速度" :value="avgResponseTime" suffix="ms">
                    <template #prefix>
                      <span style="font-size: 24px">⚡</span>
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

const message = useMessage()
const dialog = useDialog()

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
  { label: '接收', value: 'input' },
  { label: '发送', value: 'output' }
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

onMounted(() => {
  loadMessages()
  loadStatistics()
  loadAnalysisData()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 清理图表
  charts.forEach(chart => chart.dispose())
  charts = []

  window.removeEventListener('resize', handleResize)
})

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
      await nextTick()
      renderCharts(result.data)
    }
  } catch (error: any) {
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
  // 清理旧图表
  charts.forEach(chart => chart.dispose())
  charts = []

  // 消息趋势图
  if (messageTrendRef.value) {
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
  }

  // 消息类型分布（饼图）
  if (messageTypeRef.value) {
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
  }

  // 活跃时段（热力图）
  if (activeHoursRef.value) {
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
  }

  // 动作使用排行
  if (motionRankRef.value) {
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
  }

  // 表情使用排行
  if (expressionRankRef.value) {
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
  }
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

function formatTimestamp(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')
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
</script>

<style scoped lang="scss">
.history-window {
  width: 100vw;
  height: 100vh;
  background: var(--color-bg-dark);
  overflow: auto;
}

.history-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--spacing-lg);

  h1 {
    margin-bottom: var(--spacing-md);
    font-size: 24px;
    font-weight: 600;
  }
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
</style>
