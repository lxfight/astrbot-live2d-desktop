<template>
  <SettingsPageScaffold>
    <template #headerExtra>
      <SettingsPageActions>
        <template #status>
          <span class="status-pill" :class="currentModelStatusClass">
            {{ currentModelStatusLabel }}
          </span>
        </template>
        <NButton v-if="currentModelPath" :disabled="saving" @click="loadConfig">
          <template #icon>
            <RefreshCw :size="15" />
          </template>
          {{ $t('settings.modelConfig.reload') }}
        </NButton>
        <NButton v-if="currentModelPath" type="primary" :loading="saving" @click="saveConfig">
          <template #icon>
            <Save :size="15" />
          </template>
          {{ $t('settings.modelConfig.save') }}
        </NButton>
      </SettingsPageActions>
    </template>

    <SettingsSubsection>
      <template v-if="currentModelPath">
        <div class="current-model-info">
          <div class="current-model-info__preview" :style="themeSwatchStyle">
            <span>{{ currentModelInitial }}</span>
          </div>
          <div class="current-model-info__meta">
            <strong>{{ currentModelDisplay }}</strong>
            <span class="current-model-info__color">{{ sourceColor.toUpperCase() }}</span>
            <code class="settings-inline-path">{{ currentModelPath }}</code>
          </div>
        </div>
      </template>
      <n-empty v-else :description="$t('settings.model.current.notLoaded')" />
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.model.current.behavior')"
      :description="$t('settings.model.current.behaviorDesc')"
    >
      <template v-if="currentModelPath">
        <n-form label-placement="top">
          <n-form-item :label="$t('settings.model.current.idleActivity')">
            <div class="slider-row">
              <n-slider
                :value="currentModelBehavior.idleActivity"
                :min="0"
                :max="1"
                :step="0.05"
                :format-tooltip="formatIdleActivity"
                class="slider-row__slider"
                @update:value="handleIdleActivityChange"
              />
              <span class="slider-row__value">{{
                formatIdleActivity(currentModelBehavior.idleActivity)
              }}</span>
            </div>
            <template #feedback>
              {{ $t('settings.model.current.idleActivityFeedback') }}
            </template>
          </n-form-item>
          <n-form-item :label="$t('settings.model.current.persistentExpressions')">
            <NSelect
              multiple
              clearable
              filterable
              size="small"
              :options="expressionOptions"
              :value="currentModelBehavior.persistentExpressions"
              :placeholder="$t('settings.model.current.persistentExpressionsPlaceholder')"
              @update:value="handlePersistentExpressionsChange"
            />
            <template #feedback>
              {{ $t('settings.model.current.persistentExpressionsFeedback') }}
            </template>
          </n-form-item>
        </n-form>
      </template>
      <n-empty v-else :description="$t('settings.model.current.notLoaded')" />
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.model.current.preferences')"
      :description="$t('settings.model.current.preferencesDesc')"
    >
      <n-form label-placement="top">
        <n-form-item :label="$t('settings.model.current.scale')">
          <div class="slider-row">
            <n-slider
              :value="currentModelScaleValue"
              :min="0.1"
              :max="5.0"
              :step="0.05"
              class="slider-row__slider"
              @update:value="handleModelScaleChange"
            />
            <n-input-number
              :value="currentModelScaleValue"
              :min="0.1"
              :max="5.0"
              :step="0.05"
              size="small"
              class="slider-row__number"
              @update:value="(value: number | null) => handleModelScaleChange(value || 1.0)"
            >
              <template #suffix>x</template>
            </n-input-number>
            <NButton size="small" @click="handleResetModelScale">{{
              $t('settings.model.current.resetScale')
            }}</NButton>
          </div>
        </n-form-item>
        <n-form-item :label="$t('settings.model.current.themeFollowModel')">
          <NSwitch
            v-model:value="advancedSettings.themeFollowModel"
            @update:value="handleThemeFollowChange"
          />
          <template #feedback>
            {{ $t('settings.model.current.themeFollowFeedback') }}
          </template>
        </n-form-item>
      </n-form>

      <div class="settings-kv-list">
        <div class="settings-kv-list__row">
          <span>{{ $t('settings.model.current.currentThemeColor') }}</span>
          <span class="theme-color-control">
            <span class="theme-color-swatch" :style="{ backgroundColor: sourceColor }"></span>
            <strong>{{ sourceColor.toUpperCase() }}</strong>
            <input
              type="color"
              :value="sourceColor"
              class="theme-color-picker"
              :aria-label="$t('settings.model.current.pickColor')"
              @input="handleColorPick"
            />
            <NButton v-if="manualColorOverride" size="tiny" secondary @click="handleResetAutoColor">
              {{ $t('settings.model.current.resetAutoColor') }}
            </NButton>
          </span>
        </div>
        <div class="settings-kv-list__row">
          <span>{{ $t('settings.model.current.syncStatus') }}</span>
          <strong>{{ syncStatusLabel }}</strong>
        </div>
      </div>
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.modelConfig.motions')"
      :description="$t('settings.modelConfig.motionsDesc')"
    >
      <template #actions>
        <NButton v-if="currentModelPath" size="small" @click="autoGenerateAliases">
          {{ $t('settings.modelConfig.autoGenerate') }}
        </NButton>
      </template>

      <template v-if="currentModelPath">
        <p v-if="motionAliases.length" class="model-alias-table-hint">
          {{ $t('settings.modelConfig.motionCount', { count: motionAliases.length }) }}
        </p>
        <div class="model-alias-table-wrap">
          <n-data-table
            :columns="motionColumns"
            :data="motionAliases"
            :pagination="false"
            :single-line="false"
            :bordered="false"
            striped
            max-height="400px"
          />
        </div>
      </template>
      <n-empty v-else :description="$t('settings.model.current.notLoaded')" />
    </SettingsSubsection>

    <SettingsSubsection
      :title="$t('settings.modelConfig.expressions')"
      :description="$t('settings.modelConfig.expressionsDesc')"
    >
      <template v-if="currentModelPath">
        <div class="model-alias-table-wrap">
          <n-data-table
            :columns="expressionColumns"
            :data="expressionAliases"
            :pagination="false"
            :single-line="false"
            :bordered="false"
            striped
            max-height="300px"
          />
        </div>
      </template>
      <n-empty v-else :description="$t('settings.model.current.notLoaded')" />
    </SettingsSubsection>

    <SettingsSubsection v-if="currentModelPath">
      <div class="settings-section__actions">
        <NButton @click="captureModelThumbnail">
          <template #icon>
            <Camera :size="15" />
          </template>
          {{ $t('settings.modelConfig.captureThumbnail') }}
        </NButton>
      </div>
    </SettingsSubsection>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, h } from 'vue'
import { NButton, NInput, NSelect, NSwitch, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { Camera, RefreshCw, Save } from 'lucide-vue-next'
import SettingsPageActions from '../shared/SettingsPageActions.vue'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import SettingsSubsection from '../shared/SettingsSubsection.vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'
import { useAdvancedSettingsDomain } from '../domains/createAdvancedSettingsDomain'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'
import { useModelAliasConfigEditor } from '../composables/useModelAliasConfigEditor'
import type { ExpressionAliasConfig, MotionAliasConfig } from '@/shared/modelConfigFactory'
import { parseMotionIdParts } from '@/shared/modelAliasMerge'

const { t } = useI18n()
const message = useMessage()
const { advancedSettings, handleThemeFollowChange } = useAdvancedSettingsDomain()
const {
  currentModelDisplay,
  currentModelInitial,
  currentModelPath,
  currentModelScaleValue,
  currentModelStatusClass,
  currentModelStatusLabel,
  currentModelBehavior,
  handleIdleActivityChange,
  handlePersistentExpressionsChange,
  handleModelScaleChange,
  handleResetModelScale,
  sourceColor,
  themeSwatchStyle
} = useModelSettingsDomain()

const themeStore = useThemeStore()
const { manualColorOverride } = storeToRefs(themeStore)

const {
  saving,
  motionAliases,
  expressionAliases,
  loadConfig,
  autoGenerateAliases,
  saveConfig,
  patchMotionAlias,
  patchExpressionAlias
} = useModelAliasConfigEditor(currentModelPath)

function handleColorPick(event: Event) {
  const input = event.target as HTMLInputElement
  if (input?.value) {
    themeStore.setManualColor(input.value)
  }
}

function handleResetAutoColor() {
  themeStore.resetToAutoColor()
}

function formatIdleActivity(value: number) {
  return `${Math.round(value * 100)}%`
}

const syncStatusLabel = computed(() => {
  if (!advancedSettings.value.themeFollowModel) {
    return t('settings.model.current.syncDisabled')
  }
  return currentModelPath.value
    ? t('settings.model.current.followingModel')
    : t('settings.model.current.waitingForModel')
})

const expressionOptions = computed(() =>
  expressionAliases.value.map(row => ({
    label: row.name || row.id,
    value: row.id
  }))
)

async function previewMotionRow(row: { id: string }) {
  const { group, index } = parseMotionIdParts(row.id)
  const result = await window.electron.model.previewMotion({
    group,
    index,
    priority: 2,
    loop: false
  })
  if (!result.success) {
    message.warning(result.error || t('settings.modelConfig.previewFailed'))
  }
}

async function previewExpressionRow(row: { id: string }) {
  const result = await window.electron.model.previewExpression({
    id: row.id,
    holdMs: 2500,
    resetPolicy: 'neutral',
    fade: 200
  })
  if (!result.success) {
    message.warning(result.error || t('settings.modelConfig.previewFailed'))
  }
}

async function captureModelThumbnail() {
  const result = await window.electron.model.captureThumbnail()
  if (!result.success || !result.dataUrl) {
    message.warning(result.error || t('settings.modelConfig.thumbnailFailed'))
    return
  }
  message.success(t('settings.modelConfig.thumbnailCaptured'))
  console.log('[别名配置] 缩略图 dataUrl 长度:', result.dataUrl.length)
}

const motionColumns = computed<DataTableColumns<MotionAliasConfig>>(() => [
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
  },
  {
    key: 'preview',
    title: t('settings.modelConfig.preview'),
    width: 90,
    render: row =>
      h(
        NButton,
        { size: 'tiny', secondary: true, onClick: () => void previewMotionRow(row) },
        { default: () => t('settings.modelConfig.preview') }
      )
  }
])

const expressionColumns = computed<DataTableColumns<ExpressionAliasConfig>>(() => [
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
  },
  {
    key: 'preview',
    title: t('settings.modelConfig.preview'),
    width: 90,
    render: row =>
      h(
        NButton,
        { size: 'tiny', secondary: true, onClick: () => void previewExpressionRow(row) },
        { default: () => t('settings.modelConfig.preview') }
      )
  }
])

onMounted(() => {
  console.log('[别名配置] 组件挂载, currentModelPath:', currentModelPath.value)
  void loadConfig()
})

watch(currentModelPath, newPath => {
  console.log('[别名配置] 模型切换:', newPath)
  void loadConfig()
})
</script>

<style scoped>
.current-model-info {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.current-model-info__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  color: var(--theme-accent-contrast);
  font-size: 24px;
  font-weight: 700;
  flex-shrink: 0;
}

.current-model-info__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.current-model-info__meta strong {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--color-text-primary);
}

.current-model-info__color {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.settings-inline-path {
  display: block;
  padding: 8px 10px;
  border-radius: var(--desktop-radius-control);
  background: var(--settings-bg-content);
  border: 1px solid var(--settings-border);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}

.expression-type-alert {
  margin-bottom: 12px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.slider-row__slider {
  flex: 1;
  min-width: 0;
}

.slider-row__value {
  min-width: 48px;
  text-align: right;
  color: var(--color-text-primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.slider-row__number {
  width: 110px;
  flex-shrink: 0;
}

.model-alias-table-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.model-alias-table-wrap {
  /* 外框与表色见 settings-shell.scss，随浅色/深色 --settings-* 切换 */
}

.model-alias-table-wrap :deep(.n-data-table-th),
.model-alias-table-wrap :deep(.n-data-table-td) {
  font-size: 12px;
}

.model-alias-table-wrap :deep(.n-input),
.model-alias-table-wrap :deep(.n-base-selection) {
  --n-color: var(--settings-control-bg);
  --n-border: 1px solid var(--settings-control-border);
}

.expression-type-groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.expression-type-group h3 {
  margin: 0 0 10px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.expression-type-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.expression-type-row {
  display: grid;
  grid-template-columns: minmax(86px, 0.34fr) minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--desktop-panel-border);
  border-radius: var(--desktop-radius-control);
  background: rgba(255, 255, 255, 0.02);
}

.expression-type-row__meta {
  min-width: 0;
}

.expression-type-row__meta strong,
.expression-type-row__meta code {
  display: block;
}

.expression-type-row__meta strong {
  margin-bottom: 3px;
  font-size: 13px;
}

.expression-type-row__meta code {
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  font-size: 10px;
  word-break: break-all;
}

.theme-color-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.theme-color-swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

.theme-color-picker {
  width: 30px;
  height: 30px;
  padding: 3px;
  border: 1px solid var(--settings-control-border);
  border-radius: 8px;
  cursor: pointer;
  background: var(--settings-control-bg);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.theme-color-picker:hover {
  border-color: rgba(var(--color-accent-rgb), 0.42);
  box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.16);
}

.theme-color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.theme-color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 5px;
}
</style>
