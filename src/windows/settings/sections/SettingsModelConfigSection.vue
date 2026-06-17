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
import { computed, h, onMounted, watch } from 'vue'
import { NInput, NSelect, NSwitch, NButton } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'
import { useModelAliasConfigEditor } from '../composables/useModelAliasConfigEditor'
import type { ExpressionAliasConfig, MotionAliasConfig } from '@/shared/modelConfigFactory'

const { t } = useI18n()
const { currentModelPath } = useModelSettingsDomain()

const {
  loading,
  saving,
  motionAliases,
  expressionAliases,
  loadConfig,
  autoGenerateAliases,
  saveConfig,
  patchMotionAlias,
  patchExpressionAlias
} = useModelAliasConfigEditor(currentModelPath)

const hasModel = computed(() => Boolean(currentModelPath.value))

const motionColumns: DataTableColumns<MotionAliasConfig> = [
  {
    key: 'enabled',
    title: t('settings.modelConfig.enabled'),
    width: 80,
    render: row =>
      h(NSwitch, {
        value: row.enabled,
        onUpdateValue: value => patchMotionAlias(row.id, { enabled: value })
      })
  },
  { key: 'id', title: t('settings.modelConfig.motionId'), width: 120 },
  {
    key: 'name',
    title: t('settings.modelConfig.alias'),
    width: 150,
    render: row =>
      h(NInput, {
        value: row.name,
        onUpdateValue: value => patchMotionAlias(row.id, { name: value }),
        size: 'small'
      })
  },
  {
    key: 'category',
    title: t('settings.modelConfig.category'),
    width: 120,
    render: row =>
      h(NSelect, {
        value: row.category,
        onUpdateValue: value =>
          patchMotionAlias(row.id, { category: value as MotionAliasConfig['category'] }),
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
    render: row =>
      h(NInput, {
        value: row.description,
        onUpdateValue: value => patchMotionAlias(row.id, { description: value }),
        size: 'small'
      })
  }
]

const expressionColumns: DataTableColumns<ExpressionAliasConfig> = [
  {
    key: 'enabled',
    title: t('settings.modelConfig.enabled'),
    width: 80,
    render: row =>
      h(NSwitch, {
        value: row.enabled,
        onUpdateValue: value => patchExpressionAlias(row.id, { enabled: value })
      })
  },
  { key: 'id', title: t('settings.modelConfig.expressionId'), width: 120 },
  {
    key: 'name',
    title: t('settings.modelConfig.alias'),
    width: 150,
    render: row =>
      h(NInput, {
        value: row.name,
        onUpdateValue: value => patchExpressionAlias(row.id, { name: value }),
        size: 'small'
      })
  },
  {
    key: 'description',
    title: t('settings.modelConfig.description'),
    render: row =>
      h(NInput, {
        value: row.description,
        onUpdateValue: value => patchExpressionAlias(row.id, { description: value }),
        size: 'small'
      })
  }
]

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
