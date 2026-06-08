<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.menu.model.current') }}</h2>
      <span class="status-pill" :class="currentModelStatusClass">
        {{ currentModelStatusLabel }}
      </span>
    </div>
    <p class="settings-section__desc">{{ $t('settings.model.current.description') }}</p>

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
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.model.current.expressions') }}</h2>
      <n-button
        size="small"
        type="primary"
        :disabled="!currentModelPath || expressionTypeStatus === 'loading' || expressionTypeSaving"
        :loading="expressionTypeSaving"
        @click="handleSaveExpressionTypes"
      >
        {{ $t('settings.model.current.saveExpression') }}
      </n-button>
    </div>
    <p class="settings-section__desc">{{ $t('settings.model.current.expressionDesc') }}</p>

    <template v-if="currentModelPath">
      <n-alert
        v-if="expressionTypeProfilePath"
        type="info"
        :show-icon="false"
        class="expression-type-alert"
      >
        {{
          $t('settings.model.current.expressionProfilePath', { path: expressionTypeProfilePath })
        }}
      </n-alert>

      <div v-if="expressionTypeExpressions.length > 0" class="expression-type-groups">
        <div v-for="group in expressionTypeGroups" :key="group.name" class="expression-type-group">
          <h3>{{ group.name }}</h3>
          <div class="expression-type-grid">
            <div v-for="type in group.items" :key="type.key" class="expression-type-row">
              <div class="expression-type-row__meta">
                <strong>{{ type.label }}</strong>
                <code>{{ type.key }}</code>
              </div>
              <n-select
                multiple
                clearable
                filterable
                size="small"
                :options="expressionOptions"
                :value="expressionTypePresets[type.key]"
                :placeholder="$t('settings.model.current.unassigned')"
                @update:value="(value: string[]) => handleExpressionTypeChange(type.key, value)"
              />
            </div>
          </div>
        </div>
      </div>
      <n-empty v-else :description="$t('settings.model.current.noExpressions')" />
    </template>
    <n-empty v-else :description="$t('settings.model.current.notLoaded')" />
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>{{ $t('settings.model.current.preferences') }}</h2>
    </div>
    <p class="settings-section__desc">{{ $t('settings.model.current.preferencesDesc') }}</p>

    <n-form label-placement="top">
      <n-form-item :label="$t('settings.model.current.scale')">
        <n-space align="center" style="width: 100%">
          <n-slider
            :value="currentModelScaleValue"
            :min="0.1"
            :max="5.0"
            :step="0.05"
            style="width: 200px"
            @update:value="handleModelScaleChange"
          />
          <n-input-number
            :value="currentModelScaleValue"
            :min="0.1"
            :max="5.0"
            :step="0.05"
            size="small"
            style="width: 110px"
            @update:value="(value: number | null) => handleModelScaleChange(value || 1.0)"
          >
            <template #suffix>x</template>
          </n-input-number>
          <n-button size="small" @click="handleResetModelScale">{{
            $t('settings.model.current.resetScale')
          }}</n-button>
        </n-space>
      </n-form-item>
      <n-form-item :label="$t('settings.model.current.themeFollowModel')">
        <n-switch
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
          <n-button v-if="manualColorOverride" size="tiny" secondary @click="handleResetAutoColor">
            {{ $t('settings.model.current.resetAutoColor') }}
          </n-button>
        </span>
      </div>
      <div class="settings-kv-list__row">
        <span>{{ $t('settings.model.current.syncStatus') }}</span>
        <strong>{{ syncStatusLabel }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  createLive2DExpressionTypeMeta,
  type Live2DExpressionTypeMeta
} from '@/shared/live2dExpressionTypes'
import { useThemeStore } from '@/stores/theme'
import { useAdvancedSettingsDomain } from '../domains/createAdvancedSettingsDomain'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'

const { t } = useI18n()
const { advancedSettings, handleThemeFollowChange } = useAdvancedSettingsDomain()
const {
  currentModelDisplay,
  currentModelInitial,
  currentModelPath,
  currentModelScaleValue,
  currentModelStatusClass,
  currentModelStatusLabel,
  expressionTypeExpressions,
  expressionTypePresets,
  expressionTypeProfilePath,
  expressionTypeSaving,
  expressionTypeStatus,
  handleExpressionTypeChange,
  handleModelScaleChange,
  handleResetModelScale,
  handleSaveExpressionTypes,
  sourceColor,
  themeSwatchStyle
} = useModelSettingsDomain()

const themeStore = useThemeStore()
const { manualColorOverride } = storeToRefs(themeStore)

function handleColorPick(event: Event) {
  const input = event.target as HTMLInputElement
  if (input?.value) {
    themeStore.setManualColor(input.value)
  }
}

function handleResetAutoColor() {
  themeStore.resetToAutoColor()
}

const expressionTypeGroups = computed(() => {
  const groups: Array<{ name: string; items: Live2DExpressionTypeMeta[] }> = []
  for (const item of createLive2DExpressionTypeMeta(t)) {
    let group = groups.find(candidate => candidate.name === item.group)
    if (!group) {
      group = { name: item.group, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
})

const expressionOptions = computed(() =>
  expressionTypeExpressions.value.map(entry => ({
    label:
      entry.aliases.length > 1
        ? `${entry.id}（${entry.aliases.slice(1, 3).join('、')}）`
        : entry.id,
    value: entry.id
  }))
)

const syncStatusLabel = computed(() => {
  if (!advancedSettings.value.themeFollowModel) {
    return t('settings.model.current.syncDisabled')
  }
  return currentModelPath.value
    ? t('settings.model.current.followingModel')
    : t('settings.model.current.waitingForModel')
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
  line-height: 1.2;
}

.current-model-info__color {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.settings-inline-path {
  display: block;
  padding: 8px 10px;
  border-radius: var(--desktop-radius-control);
  background: rgba(0, 0, 0, 0.14);
  border: 1px solid var(--desktop-panel-border);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}

.expression-type-alert {
  margin-bottom: 12px;
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
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-color-swatch {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.theme-color-picker {
  width: 28px;
  height: 28px;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}

.theme-color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.theme-color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}
</style>
