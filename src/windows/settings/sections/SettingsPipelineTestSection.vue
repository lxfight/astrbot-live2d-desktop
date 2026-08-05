<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.menu.advanced.pipelineTest') }}</h2>
    </div>
    <p class="settings-section__desc">
      {{ $t('settings.advanced.pipelineTest.description') }}
    </p>

    <n-card size="small" :title="$t('settings.advanced.pipelineTest.bridge.title')">
      <n-space vertical size="small">
        <n-alert type="info" :bordered="false">
          {{ $t('settings.advanced.pipelineTest.bridge.desc') }}
        </n-alert>
        <n-space>
          <n-button size="small" :loading="running === 'touch'" @click="runTouchTest">
            {{ $t('settings.advanced.pipelineTest.action.touch') }}
          </n-button>
          <n-button size="small" :loading="running === 'expression'" @click="runExpressionTest">
            {{ $t('settings.advanced.pipelineTest.action.expression') }}
          </n-button>
          <n-button size="small" :loading="running === 'perform'" @click="runPerformTest">
            {{ $t('settings.advanced.pipelineTest.action.perform') }}
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <n-card v-if="results.length" size="small" :title="$t('settings.advanced.pipelineTest.results')" class="pipeline-results">
      <n-space vertical size="small">
        <div v-for="entry in results" :key="entry.id" class="pipeline-result">
          <n-tag :type="entry.success ? 'success' : 'error'" size="small">
            {{ entry.success ? 'PASS' : 'FAIL' }}
          </n-tag>
          <span class="pipeline-result__name">{{ entry.name }}</span>
          <n-text depth="3">{{ entry.message }}</n-text>
        </div>
      </n-space>
    </n-card>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMessage } from 'naive-ui'

type PipelineTestKind = 'touch' | 'expression' | 'perform'

interface PipelineResult {
  id: number
  name: string
  success: boolean
  message: string
}

const message = useMessage()
const running = ref<PipelineTestKind | null>(null)
const results = ref<PipelineResult[]>([])
let resultId = 0

function pushResult(name: string, success: boolean, detail: string) {
  results.value.unshift({ id: ++resultId, name, success, message: detail })
}

async function runWithResult(kind: PipelineTestKind, name: string, task: () => Promise<void>) {
  running.value = kind
  try {
    await task()
    pushResult(name, true, 'ok')
    message.success(`${name}: ok`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    pushResult(name, false, detail)
    message.error(`${name}: ${detail}`)
  } finally {
    running.value = null
  }
}

async function runTouchTest() {
  await runWithResult('touch', 'bridge.sendTouch(mouse-tracking)', async () => {
    const result = await window.electron.bridge.sendTouch(0.5, 0.5, 'move')
    if (!result.success) throw new Error(result.error || 'sendTouch failed')
  })
}

async function runExpressionTest() {
  await runWithResult('expression', 'bridge.sendState(expression)', async () => {
    const result = await window.electron.bridge.sendState('pipeline.test.expression', {
      type: 'expression',
      expressionId: 'Happy',
      source: 'settings-pipeline-test'
    })
    if (!result.success) throw new Error(result.error || 'sendState failed')
  })
}

async function runPerformTest() {
  await runWithResult('perform', 'bridge.sendMessage(perform)', async () => {
    const result = await window.electron.bridge.sendMessage({
      type: 'text',
      text: '[pipeline-test] perform route probe'
    })
    if (!result.success) throw new Error(result.error || 'sendMessage failed')
  })
}
</script>

<style scoped>
.pipeline-results {
  margin-top: 12px;
}

.pipeline-result {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.pipeline-result__name {
  font-weight: 600;
}
</style>
