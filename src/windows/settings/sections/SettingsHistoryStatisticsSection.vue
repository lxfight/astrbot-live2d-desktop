<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>统计概览</h2>
      <n-date-picker
        v-model:value="dateRange"
        type="daterange"
        clearable
        size="small"
        @update:value="handleDateRangeChange"
      />
    </div>
    <p class="settings-section__desc">消息趋势和内容分布统计。</p>

    <div class="chart-grid">
      <div class="chart-card">
        <h3>消息趋势</h3>
        <div ref="messageTrendRef" class="chart-container"></div>
      </div>
      <div class="chart-card">
        <h3>内容分布</h3>
        <div ref="performElementRef" class="chart-container"></div>
      </div>
      <div class="chart-card chart-card--wide">
        <h3>活跃时段</h3>
        <div ref="activeHoursRef" class="chart-container"></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import * as echarts from 'echarts'
import { useThemeStore } from '@/stores/theme'
import { withAlpha } from '@/utils/themePalette'
import { useHistorySettingsDomain } from '../domains/createHistorySettingsDomain'

const { dateRange, handleDateRangeChange, statisticsData } = useHistorySettingsDomain()

const themeStore = useThemeStore()
const { palette } = storeToRefs(themeStore)

const messageTrendRef = ref<HTMLElement>()
const performElementRef = ref<HTMLElement>()
const activeHoursRef = ref<HTMLElement>()

let charts: echarts.ECharts[] = []

function disposeCharts() {
  charts.forEach((chart) => chart.dispose())
  charts = []
}

function handleResize() {
  charts.forEach((chart) => chart.resize())
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
      textStyle: { color: palette.value.textPrimary },
    },
  }

  if (messageTrendRef.value) {
    const chart = echarts.init(messageTrendRef.value)
    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.date),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: labelColor },
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [{
        name: '消息数',
        type: 'line',
        data: data.map((item) => item.message_count),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: chartColors[0] },
            { offset: 1, color: chartColors[1] },
          ]),
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(chartColors[0], 0.28) },
            { offset: 1, color: withAlpha(chartColors[1], 0.06) },
          ]),
        },
      }],
    })
    charts.push(chart)
  }

  if (performElementRef.value) {
    const chart = echarts.init(performElementRef.value)
    const totalData = data.reduce((accumulator, item) => {
      accumulator.text += item.text_count || 0
      accumulator.image += item.image_count || 0
      accumulator.audio += item.audio_count || 0
      accumulator.video += item.video_count || 0
      return accumulator
    }, { text: 0, image: 0, audio: 0, video: 0 })

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['文字', '图片', '音频', '视频'],
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: labelColor },
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [{
        name: '使用量',
        type: 'bar',
        barWidth: '40%',
        data: [totalData.text, totalData.image, totalData.audio, totalData.video],
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors[2] },
            { offset: 1, color: chartColors[0] },
          ]),
        },
      }],
    })
    charts.push(chart)
  }

  if (activeHoursRef.value) {
    const chart = echarts.init(activeHoursRef.value)
    const hourData = new Array(24).fill(0)

    data.forEach((item) => {
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
        axisLabel: { color: labelColor },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: labelColor },
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [{
        name: '消息数',
        type: 'bar',
        barWidth: '60%',
        data: hourData,
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors[3] },
            { offset: 1, color: chartColors[4] },
          ]),
        },
      }],
    })
    charts.push(chart)
  }
}

watch([statisticsData, palette], async ([data]) => {
  await nextTick()
  renderCharts(data)
}, { deep: true, immediate: true })

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
