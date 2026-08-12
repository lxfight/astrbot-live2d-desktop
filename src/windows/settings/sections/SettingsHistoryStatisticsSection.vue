<template>
  <SettingsPageScaffold class="settings-workspace-page">
    <div class="settings-workspace-toolbar">
      <div class="settings-workspace-toolbar__spacer" />
      <n-date-picker
        v-model:value="dateRange"
        type="daterange"
        clearable
        size="small"
        @update:value="handleDateRangeChange"
      />
    </div>

    <div class="settings-workspace-body chart-grid">
      <div class="chart-card settings-section">
        <h3>{{ $t('settings.history.statistics.messageTrend') }}</h3>
        <div ref="messageTrendRef" class="chart-container"></div>
      </div>
      <div class="chart-card settings-section">
        <h3>{{ $t('settings.history.statistics.contentDistribution') }}</h3>
        <div ref="performElementRef" class="chart-container"></div>
      </div>
      <div class="chart-card chart-card--wide settings-section">
        <h3>{{ $t('settings.history.statistics.activeHours') }}</h3>
        <div ref="activeHoursRef" class="chart-container"></div>
      </div>
      <div class="chart-card settings-section">
        <h3>{{ $t('settings.history.statistics.motionUsage') }}</h3>
        <div ref="motionUsageRef" class="chart-container"></div>
      </div>
      <div class="chart-card settings-section">
        <h3>{{ $t('settings.history.statistics.expressionUsage') }}</h3>
        <div ref="expressionUsageRef" class="chart-container"></div>
      </div>
    </div>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import * as echarts from 'echarts'
import { useThemeStore } from '@/stores/theme'
import { withAlpha } from '@/utils/themePalette'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import { useHistorySettingsDomain } from '../domains/createHistorySettingsDomain'

const { t } = useI18n()
const { dateRange, handleDateRangeChange, statisticsData } = useHistorySettingsDomain()

const themeStore = useThemeStore()
const { palette } = storeToRefs(themeStore)

const messageTrendRef = ref<HTMLElement>()
const performElementRef = ref<HTMLElement>()
const activeHoursRef = ref<HTMLElement>()
const motionUsageRef = ref<HTMLElement>()
const expressionUsageRef = ref<HTMLElement>()

let charts: echarts.ECharts[] = []

function disposeCharts() {
  charts.forEach(chart => chart.dispose())
  charts = []
}

function handleResize() {
  charts.forEach(chart => chart.resize())
}

function renderCharts(data: any[]) {
  disposeCharts()
  if (!data.length) {
    return
  }

  const chartColors = palette.value.chartPalette
  const axisColor = 'rgba(255, 255, 255, 0.18)'
  const labelColor = palette.value.textSecondary
  const gridColor = 'rgba(255, 255, 255, 0.08)'
  const tooltipBackground = 'rgba(8, 12, 20, 0.92)'

  const commonOption = {
    backgroundColor: 'transparent',
    textStyle: { color: labelColor },
    tooltip: {
      backgroundColor: tooltipBackground,
      borderColor: axisColor,
      textStyle: { color: palette.value.textPrimary }
    }
  }

  if (messageTrendRef.value) {
    const chart = echarts.init(messageTrendRef.value)
    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map(item => item.date),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: labelColor }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [
        {
          name: t('settings.history.statistics.messageCount'),
          type: 'line',
          data: data.map(item => item.message_count),
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
        }
      ]
    })
    charts.push(chart)
  }

  if (performElementRef.value) {
    const chart = echarts.init(performElementRef.value)
    const totalData = data.reduce(
      (accumulator, item) => {
        accumulator.text += item.text_count || 0
        accumulator.image += item.image_count || 0
        accumulator.audio += item.audio_count || 0
        accumulator.video += item.video_count || 0
        return accumulator
      },
      { text: 0, image: 0, audio: 0, video: 0 }
    )

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: [
          t('settings.history.statistics.text'),
          t('settings.history.statistics.image'),
          t('settings.history.statistics.audio'),
          t('settings.history.statistics.video')
        ],
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: labelColor }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [
        {
          name: t('settings.history.statistics.usageCount'),
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
        }
      ]
    })
    charts.push(chart)
  }

  if (activeHoursRef.value) {
    const chart = echarts.init(activeHoursRef.value)
    const hourData = new Array(24).fill(0)

    data.forEach(item => {
      if (item.hour !== null && item.hour !== undefined) {
        hourData[item.hour] += item.message_count || 0
      }
    })

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, index) => `${index}`),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: labelColor }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [
        {
          name: t('settings.history.statistics.messageCount'),
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
        }
      ]
    })
    charts.push(chart)
  }

  renderUsageChart(motionUsageRef, 'motion_usage', chartColors[0])
  renderUsageChart(expressionUsageRef, 'expression_usage', chartColors[2])
}

type UsageEntry = { name: string; count: number }

function renderUsageChart(
  containerRef: Ref<HTMLElement | undefined>,
  field: 'motion_usage' | 'expression_usage',
  accentColor: string
) {
  if (!containerRef.value) {
    return
  }

  const merged: Record<string, number> = {}
  for (const item of statisticsData.value) {
    const raw = item[field]
    if (!raw || typeof raw !== 'object') {
      continue
    }
    for (const [name, count] of Object.entries(raw as Record<string, number>)) {
      merged[name] = (merged[name] ?? 0) + (Number.isFinite(count) ? count : 0)
    }
  }

  const entries: UsageEntry[] = Object.entries(merged)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  if (entries.length === 0) {
    return
  }

  const chart = echarts.init(containerRef.value)
  chart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: 'rgba(185, 192, 207, 0.82)' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(8, 12, 20, 0.92)',
      borderColor: 'rgba(255, 255, 255, 0.18)',
      textStyle: { color: 'rgba(247, 249, 252, 0.96)' }
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.08)' } },
      axisLabel: { color: 'rgba(185, 192, 207, 0.82)' }
    },
    yAxis: {
      type: 'category',
      data: entries.map(entry => entry.name),
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.18)' } },
      axisLabel: { color: 'rgba(185, 192, 207, 0.82)', width: 90, overflow: 'truncate' }
    },
    grid: { top: 20, right: 24, bottom: 20, left: 100, containLabel: true },
    series: [
      {
        name: t('settings.history.statistics.usageCount'),
        type: 'bar',
        barWidth: '55%',
        data: entries.map(entry => entry.count),
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: accentColor
        }
      }
    ]
  })
  charts.push(chart)
}

watch(
  [statisticsData, palette],
  async ([data]) => {
    await nextTick()
    renderCharts(data)
  },
  { deep: true, immediate: true }
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
  void nextTick().then(() => {
    renderCharts(statisticsData.value)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeCharts()
})
</script>

<style scoped lang="scss">
@use './settings-history.scss';
</style>
