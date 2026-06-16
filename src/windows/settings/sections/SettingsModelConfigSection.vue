<template>
  <div class="settings-model-config-section">
    <n-spin :show="loading">
      <n-alert v-if="!hasModel" type="info" class="mb-4">
        {{ $t('settings.modelConfig.noModel') }}
      </n-alert>

      <template v-else>
        <n-space vertical :size="24">
          <!-- 动作配置 -->
          <n-card :title="$t('settings.modelConfig.motions')" size="small">
            <template #header-extra>
              <NButton size="small" @click="autoGenerateAliases">
                {{ $t('settings.modelConfig.autoGenerate') }}
              </NButton>
            </template>

            <n-data-table
              :columns="motionColumns"
              :data="motionAliases"
              :pagination="false"
              max-height="400px"
            />
          </n-card>

          <!-- 表情配置 -->
          <n-card :title="$t('settings.modelConfig.expressions')" size="small">
            <n-data-table
              :columns="expressionColumns"
              :data="expressionAliases"
              :pagination="false"
              max-height="300px"
            />
          </n-card>

          <!-- 操作按钮 -->
          <n-space>
            <NButton type="primary" :loading="saving" @click="saveConfig">
              {{ $t('settings.modelConfig.save') }}
            </NButton>
            <NButton @click="loadConfig">
              {{ $t('settings.modelConfig.reload') }}
            </NButton>
          </n-space>
        </n-space>
      </template>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, watch } from 'vue'
import { NInput, NSelect, NSwitch, NButton, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'
import {
  buildModelConfigFromCatalog,
  generateExpressionAliasFromId,
  generateMotionAliasFromId,
  type ModelCatalogPayload
} from '@/shared/modelConfigFactory'
import { mergeAliasConfigWithCatalog } from '@/shared/modelAliasMerge'

const { t } = useI18n()
const message = useMessage()
const { currentModelPath } = useModelSettingsDomain()

const loading = ref(false)
const saving = ref(false)
const motionAliases = ref<any[]>([])
const expressionAliases = ref<any[]>([])

const hasModel = computed(() => Boolean(currentModelPath.value))

const motionColumns: DataTableColumns<any> = [
  {
    key: 'enabled',
    title: t('settings.modelConfig.enabled'),
    width: 80,
    render: (row, index) =>
      h(NSwitch, {
        value: row.enabled,
        onUpdateValue: v => {
          motionAliases.value[index].enabled = v
        }
      })
  },
  { key: 'id', title: t('settings.modelConfig.motionId'), width: 120 },
  {
    key: 'name',
    title: t('settings.modelConfig.alias'),
    width: 150,
    render: (row, index) =>
      h(NInput, {
        value: row.name,
        onUpdateValue: v => {
          motionAliases.value[index].name = v
        },
        size: 'small'
      })
  },
  {
    key: 'category',
    title: t('settings.modelConfig.category'),
    width: 120,
    render: (row, index) =>
      h(NSelect, {
        value: row.category,
        onUpdateValue: v => {
          motionAliases.value[index].category = v
        },
        options: [
          { label: t('settings.modelConfig.idle'), value: 'idle' },
          { label: t('settings.modelConfig.action'), value: 'action' }
        ],
        size: 'small'
      })
  },
  {
    key: 'description',
    title: t('settings.modelConfig.description'),
    render: (row, index) =>
      h(NInput, {
        value: row.description,
        onUpdateValue: v => {
          motionAliases.value[index].description = v
        },
        size: 'small'
      })
  }
]

const expressionColumns: DataTableColumns<any> = [
  {
    key: 'enabled',
    title: t('settings.modelConfig.enabled'),
    width: 80,
    render: (row, index) =>
      h(NSwitch, {
        value: row.enabled,
        onUpdateValue: v => {
          expressionAliases.value[index].enabled = v
        }
      })
  },
  { key: 'id', title: t('settings.modelConfig.expressionId'), width: 120 },
  {
    key: 'name',
    title: t('settings.modelConfig.alias'),
    width: 150,
    render: (row, index) =>
      h(NInput, {
        value: row.name,
        onUpdateValue: v => {
          expressionAliases.value[index].name = v
        },
        size: 'small'
      })
  },
  {
    key: 'description',
    title: t('settings.modelConfig.description'),
    render: (row, index) =>
      h(NInput, {
        value: row.description,
        onUpdateValue: v => {
          expressionAliases.value[index].description = v
        },
        size: 'small'
      })
  }
]

async function loadFromModelCatalog() {
  const modelPath = currentModelPath.value
  if (!modelPath) return
  const catalogResult = await window.electron.model.getCatalog(modelPath)
  if (!catalogResult.success || !catalogResult.catalog) return
  const config = buildModelConfigFromCatalog(catalogResult.catalog as ModelCatalogPayload)
  motionAliases.value = config.motionAliases
  expressionAliases.value = config.expressionAliases
}

async function loadConfig() {
  const modelPath = currentModelPath.value
  if (!modelPath) return

  loading.value = true
  try {
    const result = await window.electron.modelConfig.load(modelPath)

    if (result.success && result.config) {
      const catalogResult = await window.electron.model.getCatalog(modelPath)
      if (catalogResult.success && catalogResult.catalog) {
        const merged = mergeAliasConfigWithCatalog(
          result.config,
          catalogResult.catalog as ModelCatalogPayload
        )
        motionAliases.value = merged.motionAliases
        expressionAliases.value = merged.expressionAliases
      } else {
        motionAliases.value = result.config.motionAliases
        expressionAliases.value = result.config.expressionAliases
      }
    } else {
      await loadFromModelCatalog()
    }
  } catch (error) {
    console.error('[配置] 加载失败:', error)
    await loadFromModelCatalog()
  } finally {
    loading.value = false
  }
}

function autoGenerateAliases() {
  motionAliases.value.forEach(m => {
    if (!m.name || m.name === m.id) {
      m.name = generateMotionAliasFromId(m.id)
    }
  })
  expressionAliases.value.forEach(e => {
    if (!e.name || e.name === e.id) {
      e.name = generateExpressionAliasFromId(e.id)
    }
  })
  message.success(t('settings.modelConfig.generated'))
}

async function saveConfig() {
  const modelPath = currentModelPath.value
  if (!modelPath) return

  saving.value = true
  try {
    const config = {
      modelPath,
      version: '2.0',
      motionAliases: motionAliases.value,
      expressionAliases: expressionAliases.value
    }

    const result = await window.electron.modelConfig.save(config)
    if (result.success) {
      message.success(t('settings.modelConfig.saved'))
    } else {
      message.error(result.error || t('settings.modelConfig.saveFailed'))
    }
  } catch (error: any) {
    message.error(error.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadConfig()
})

watch(currentModelPath, () => {
  void loadConfig()
})
</script>

<style scoped>
.settings-model-config-section {
  padding: 16px;
}
.mb-4 {
  margin-bottom: 16px;
}
</style>
