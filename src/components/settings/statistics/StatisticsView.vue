<template>
  <div class="statistics-view">
    <header class="stats-header">
      <h2>数据统计</h2>
      <div class="date-filter">
        <button
          v-for="range in dateRanges"
          :key="range.key"
          :class="['filter-btn', { active: selectedRange === range.key }]"
          @click="selectDateRange(range.key)"
        >
          {{ range.label }}
        </button>
      </div>
    </header>

    <div class="stats-content">
      <section class="stats-cards">
        <div class="stat-card">
          <div class="card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">总消息数</div>
            <div class="card-value">{{ totalStats.total_messages || 0 }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="card-icon user">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">用户消息</div>
            <div class="card-value">{{ totalStats.user_messages || 0 }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="card-icon ai">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="10" rx="2"/>
              <circle cx="12" cy="5" r="2"/>
              <path d="M12 7v4"/>
              <line x1="8" y1="16" x2="8" y2="16"/>
              <line x1="16" y1="16" x2="16" y2="16"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">AI消息</div>
            <div class="card-value">{{ totalStats.ai_messages || 0 }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="card-icon text">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">文本消息</div>
            <div class="card-value">{{ totalStats.text_messages || 0 }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="card-icon image">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">图片消息</div>
            <div class="card-value">{{ totalStats.image_messages || 0 }}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="card-icon voice">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <div class="card-content">
            <div class="card-label">语音消息</div>
            <div class="card-value">{{ totalStats.voice_messages || 0 }}</div>
          </div>
        </div>
      </section>

      <section class="stats-chart">
        <h3>每日消息趋势</h3>
        <div v-if="dailyStats.length > 0" class="chart-container">
          <div ref="chartHost" class="line-chart">
            <svg 
              class="chart-svg" 
              :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            >
              <!-- 网格线 -->
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-soft)" stroke-width="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              <!-- Y轴刻度线和标签 -->
              <g v-for="tick in yAxisTicks" :key="tick" class="y-axis">
                <line 
                  :x1="chartPadding.left" 
                  :y1="getYPosition(tick)" 
                  :x2="chartWidth - chartPadding.right" 
                  :y2="getYPosition(tick)"
                  stroke="var(--border-soft)" 
                  stroke-width="1"
                />
                <text 
                  :x="chartPadding.left - 10" 
                  :y="getYPosition(tick) + 5"
                  fill="var(--text-muted)" 
                  font-size="12" 
                  text-anchor="end"
                >
                  {{ tick }}
                </text>
              </g>
              
              <!-- 用户消息折线 -->
              <polyline
                v-if="dailyStats.length > 1"
                :points="getLinePoints(dailyStats, 'user_messages')"
                fill="none"
                :stroke="userLineColor"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              
              <!-- AI消息折线 -->
              <polyline
                v-if="dailyStats.length > 1"
                :points="getLinePoints(dailyStats, 'ai_messages')"
                fill="none"
                :stroke="aiLineColor"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              
              <!-- 用户消息数据点 -->
              <g v-for="(stat, index) in dailyStats" :key="`user-${stat.stat_date}`" class="data-points">
                <circle
                  :cx="getXPosition(index)"
                  :cy="getYPosition(stat.user_messages)"
                  r="4"
                  :fill="userLineColor"
                  stroke="rgba(255,255,255,0.8)"
                  stroke-width="2"
                  class="data-point"
                  :title="`用户消息: ${stat.user_messages}`"
                />
              </g>
              
              <!-- AI消息数据点 -->
              <g v-for="(stat, index) in dailyStats" :key="`ai-${stat.stat_date}`" class="data-points">
                <circle
                  :cx="getXPosition(index)"
                  :cy="getYPosition(stat.ai_messages)"
                  r="4"
                  :fill="aiLineColor"
                  stroke="rgba(255,255,255,0.8)"
                  stroke-width="2"
                  class="data-point"
                  :title="`AI消息: ${stat.ai_messages}`"
                />
              </g>
              
              <!-- X轴标签 -->
              <g v-for="(stat, index) in dailyStats" :key="`label-${stat.stat_date}`" class="x-axis">
                <text
                  :x="getXPosition(index)"
                  :y="chartHeight - chartPadding.bottom + 20"
                  fill="var(--text-muted)"
                  font-size="12"
                  text-anchor="middle"
                >
                  {{ formatDate(stat.stat_date) }}
                </text>
              </g>
            </svg>
          </div>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-line user"></span>
              <span>用户消息</span>
            </div>
            <div class="legend-item">
              <span class="legend-line ai"></span>
              <span>AI消息</span>
            </div>
          </div>
        </div>
        <div v-else class="empty-chart">
          <p>暂无统计数据</p>
        </div>
      </section>

      <section class="stats-distribution">
        <h3>消息类型分布</h3>
        <div class="distribution-bars">
          <div class="dist-item">
            <div class="dist-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>文本</span>
            </div>
            <div class="dist-bar-container">
              <div
                class="dist-bar text"
                :style="{ width: getPercentage(totalStats.text_messages) }"
              ></div>
            </div>
            <div class="dist-value">{{ totalStats.text_messages || 0 }}</div>
          </div>

          <div class="dist-item">
            <div class="dist-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>图片</span>
            </div>
            <div class="dist-bar-container">
              <div
                class="dist-bar image"
                :style="{ width: getPercentage(totalStats.image_messages) }"
              ></div>
            </div>
            <div class="dist-value">{{ totalStats.image_messages || 0 }}</div>
          </div>

          <div class="dist-item">
            <div class="dist-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
              <span>语音</span>
            </div>
            <div class="dist-bar-container">
              <div
                class="dist-bar voice"
                :style="{ width: getPercentage(totalStats.voice_messages) }"
              ></div>
            </div>
            <div class="dist-value">{{ totalStats.voice_messages || 0 }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { DailyStatistics } from '@/types/history'

const dateRanges = [
  { key: 'week', label: '最近7天' },
  { key: 'month', label: '最近30天' },
  { key: 'all', label: '全部时间' }
] as const

type DateRangeKey = (typeof dateRanges)[number]['key']

const selectedRange = ref<DateRangeKey>('week')
const dailyStats = ref<DailyStatistics[]>([])
const totalStats = ref<Omit<DailyStatistics, 'id' | 'stat_date'>>({
  total_messages: 0,
  user_messages: 0,
  ai_messages: 0,
  text_messages: 0,
  image_messages: 0,
  voice_messages: 0,
  total_duration: 0,
  session_count: 0
})

const maxMessages = computed(() => {
  if (dailyStats.value.length === 0) return 1
  return Math.max(...dailyStats.value.map(s => Math.max(s.user_messages, s.ai_messages)))
})

const chartPadding = { top: 20, right: 20, bottom: 40, left: 50 }

const chartInnerWidth = computed(() => chartDimensions.value.width - chartPadding.left - chartPadding.right)
const chartInnerHeight = computed(() => chartDimensions.value.height - chartPadding.top - chartPadding.bottom)

const userLineColor = 'rgba(11, 95, 255, 0.9)'
const aiLineColor = 'rgba(38, 167, 255, 0.9)'

const yAxisTicks = computed(() => {
  if (maxMessages.value === 0) return [0]
  const max = Math.ceil(maxMessages.value / 10) * 10 // 向上取整到最近的10
  const tickCount = 5
  const step = Math.ceil(max / tickCount / 10) * 10
  const ticks = []
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(i * step)
  }
  return ticks
})

onMounted(async () => {
  await loadStatistics()
})

const selectDateRange = async (range: DateRangeKey) => {
  selectedRange.value = range
  await loadStatistics()
}

const loadStatistics = async () => {
  if (!window.electronAPI) return

  try {
    let startDate: string | undefined
    const endDate = new Date().toISOString().split('T')[0]

    if (selectedRange.value === 'week') {
      const date = new Date()
      date.setDate(date.getDate() - 7)
      startDate = date.toISOString().split('T')[0]
    } else if (selectedRange.value === 'month') {
      const date = new Date()
      date.setDate(date.getDate() - 30)
      startDate = date.toISOString().split('T')[0]
    }

    dailyStats.value = await window.electronAPI.dbGetStatistics(startDate, endDate)
    totalStats.value = await window.electronAPI.dbGetTotalStatistics()
  } catch (error) {
    console.error('[统计] 加载统计数据失败:', error)
  }
}

const getBarHeight = (value: number): string => {
  if (maxMessages.value === 0) return '0%'
  return `${(value / maxMessages.value) * 100}%`
}

const getPercentage = (value: number): string => {
  const total = totalStats.value.total_messages
  if (total === 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 折线图相关方法
const getXPosition = (index: number): number => {
  if (dailyStats.value.length <= 1) return chartPadding.left + chartInnerWidth.value / 2
  const step = chartInnerWidth.value / (dailyStats.value.length - 1)
  return chartPadding.left + index * step
}

const getYPosition = (value: number): number => {
  if (maxMessages.value === 0) return chartDimensions.value.height - chartPadding.bottom
  const percentage = value / maxMessages.value
  return chartDimensions.value.height - chartPadding.bottom - (percentage * chartInnerHeight.value)
}

const getLinePoints = (stats: DailyStatistics[], key: 'user_messages' | 'ai_messages'): string => {
  if (stats.length <= 1) return ''
  
  return stats.map((stat, index) => {
    const x = getXPosition(index)
    const y = getYPosition(stat[key])
    return `${x},${y}`
  }).join(' ')
}

// 响应式图表尺寸计算
// Chart sizing should be based on the actual container width; using window.innerWidth
// will overflow in a small settings window and can produce NaN during initial render.
const chartHost = ref<HTMLDivElement | null>(null)
const chartDimensions = ref({ width: 640, height: 360 })

const chartWidth = computed(() => chartDimensions.value.width)
const chartHeight = computed(() => chartDimensions.value.height)

let chartResizeObserver: ResizeObserver | null = null

const updateChartSize = () => {
  const host = chartHost.value
  if (!host) return

  const w = Math.max(320, Math.floor(host.clientWidth || 0))
  const aspectRatio = 16 / 9
  const h = Math.max(220, Math.floor(Math.min(w / aspectRatio, 420)))
  chartDimensions.value = { width: w, height: h }
}

onMounted(() => {
  // Run once on mount; if the chart isn't visible yet, watcher below will handle it.
  updateChartSize()

  if ('ResizeObserver' in window) {
    chartResizeObserver = new ResizeObserver(() => updateChartSize())
    if (chartHost.value) chartResizeObserver.observe(chartHost.value)
  } else {
    window.addEventListener('resize', updateChartSize)
  }
})

// When data loads, the chart container is created; measure again after render.
const chartReady = computed(() => dailyStats.value.length > 0)
watch(chartReady, async (ready) => {
  if (!ready) return
  await nextTick()
  updateChartSize()
  if (chartResizeObserver && chartHost.value) chartResizeObserver.observe(chartHost.value)
})

onUnmounted(() => {
  if (chartResizeObserver) {
    chartResizeObserver.disconnect()
    chartResizeObserver = null
  }
  window.removeEventListener('resize', updateChartSize)
})
</script>

<style scoped>
.statistics-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  color: var(--text);
}

.stats-header {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.date-filter {
  display: flex;
  gap: 8px;
}

.filter-btn {
  padding: 7px 12px;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.filter-btn:hover {
  filter: brightness(1.02);
}

.filter-btn.active {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.stats-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s;
  min-width: 0;
}

.stat-card:hover {
  transform: translateY(-2px);
  filter: brightness(1.02);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 95, 255, 0.12);
  color: var(--accent);
}

.card-icon.user {
  background: rgba(38, 167, 255, 0.14);
  color: var(--accent-2);
}

.card-icon.ai {
  background: rgba(11, 95, 255, 0.1);
  color: var(--accent);
}

.card-icon.text {
  background: rgba(11, 95, 255, 0.12);
  color: var(--accent);
}

.card-icon.image {
  background: rgba(38, 167, 255, 0.12);
  color: rgba(38, 167, 255, 0.95);
}

.card-icon.voice {
  background: rgba(38, 167, 255, 0.14);
  color: var(--accent-2);
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.card-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
}

.stats-chart {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 32px;
  overflow: hidden;
}

.stats-chart h3 {
  margin: 0 0 14px 0;
  font-size: 18px;
  font-weight: 800;
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 100%;
}

.line-chart {
  width: 100%;
  height: auto;
  border-radius: 8px;
  overflow: hidden;
}

.chart-svg {
  width: 100%;
  height: auto;
  background: var(--input-bg);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  display: block;
}

.data-point {
  transition: all 0.2s ease;
  cursor: pointer;
}

.data-point:hover {
  r: 6;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.5));
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-soft);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.legend-line {
  width: 24px;
  height: 3px;
  border-radius: 2px;
}

.legend-line.user {
  background: linear-gradient(90deg, rgba(11, 95, 255, 0.95), rgba(38, 167, 255, 0.75));
}

.legend-line.ai {
  background: linear-gradient(90deg, rgba(38, 167, 255, 0.95), rgba(140, 200, 255, 0.75));
}

.empty-chart {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.stats-distribution {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}

.stats-distribution h3 {
  margin: 0 0 24px 0;
  font-size: 18px;
  font-weight: 600;
}

.distribution-bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dist-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dist-label {
  width: 80px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-muted);
}

.dist-bar-container {
  flex: 1;
  height: 24px;
  background: var(--input-bg);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  overflow: hidden;
}

.dist-bar {
  height: 100%;
  border-radius: 12px;
  transition: width 0.3s;
}

.dist-bar.text {
  background: linear-gradient(90deg, rgba(11, 95, 255, 0.9), rgba(140, 200, 255, 0.95));
}

.dist-bar.image {
  background: linear-gradient(90deg, rgba(38, 167, 255, 0.9), rgba(140, 200, 255, 0.85));
}

.dist-bar.voice {
  background: linear-gradient(90deg, rgba(11, 95, 255, 0.75), rgba(198, 220, 255, 0.95));
}

.dist-value {
  width: 60px;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
</style>
