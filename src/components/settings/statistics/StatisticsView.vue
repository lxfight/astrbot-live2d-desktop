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
          <div class="chart-bars">
            <div
              v-for="stat in dailyStats"
              :key="stat.stat_date"
              class="chart-bar-group"
            >
              <div class="bar-container">
                <div
                  class="bar user-bar"
                  :style="{ height: getBarHeight(stat.user_messages) }"
                  :title="`用户消息: ${stat.user_messages}`"
                ></div>
                <div
                  class="bar ai-bar"
                  :style="{ height: getBarHeight(stat.ai_messages) }"
                  :title="`AI消息: ${stat.ai_messages}`"
                ></div>
              </div>
              <div class="bar-label">{{ formatDate(stat.stat_date) }}</div>
            </div>
          </div>
          <div class="chart-legend">
            <div class="legend-item">
              <span class="legend-color user"></span>
              <span>用户消息</span>
            </div>
            <div class="legend-item">
              <span class="legend-color ai"></span>
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
import { ref, onMounted, computed } from 'vue'
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
  padding: 24px;
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.date-filter {
  display: flex;
  gap: 8px;
}

.filter-btn {
  padding: 8px 16px;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
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
  padding: 24px;
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
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s;
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
  background: rgba(255, 123, 182, 0.12);
  color: var(--accent);
}

.card-icon.user {
  background: rgba(103, 183, 255, 0.14);
  color: var(--accent-2);
}

.card-icon.ai {
  background: rgba(188, 130, 255, 0.14);
  color: rgba(188, 130, 255, 0.95);
}

.card-icon.text {
  background: rgba(255, 123, 182, 0.12);
  color: var(--accent);
}

.card-icon.image {
  background: rgba(255, 110, 199, 0.14);
  color: rgba(255, 110, 199, 0.95);
}

.card-icon.voice {
  background: rgba(103, 183, 255, 0.14);
  color: var(--accent-2);
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.card-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--text);
}

.stats-chart {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
}

.stats-chart h3 {
  margin: 0 0 24px 0;
  font-size: 18px;
  font-weight: 600;
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 200px;
  padding: 0 8px;
}

.chart-bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.bar-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
}

.bar {
  flex: 1;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  transition: all 0.3s;
}

.bar.user-bar {
  background: linear-gradient(to top, rgba(255, 110, 199, 0.9), rgba(255, 123, 182, 0.7));
}

.bar.ai-bar {
  background: linear-gradient(to top, rgba(103, 183, 255, 0.9), rgba(188, 130, 255, 0.7));
}

.bar:hover {
  opacity: 0.8;
}

.bar-label {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
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

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.legend-color.user {
  background: linear-gradient(135deg, rgba(255, 110, 199, 0.9), rgba(255, 123, 182, 0.7));
}

.legend-color.ai {
  background: linear-gradient(135deg, rgba(103, 183, 255, 0.9), rgba(188, 130, 255, 0.7));
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
  background: linear-gradient(90deg, rgba(255, 123, 182, 0.9), rgba(255, 210, 230, 0.95));
}

.dist-bar.image {
  background: linear-gradient(90deg, rgba(255, 110, 199, 0.9), rgba(188, 130, 255, 0.8));
}

.dist-bar.voice {
  background: linear-gradient(90deg, rgba(103, 183, 255, 0.9), rgba(198, 220, 255, 0.95));
}

.dist-value {
  width: 60px;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
</style>
