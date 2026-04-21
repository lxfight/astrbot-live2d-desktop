<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>当前模型</h2>
      <span class="status-pill" :class="currentModelStatusClass">
        {{ currentModelStatusLabel }}
      </span>
    </div>
    <p class="settings-section__desc">查看当前加载的 Live2D 模型信息，并确认当前主题色是否来自模型配色。</p>

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
    <n-empty v-else description="当前未加载模型" />
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>模型偏好</h2>
    </div>
    <p class="settings-section__desc">配置主题色跟随策略。切换后立即生效。</p>

    <n-form label-placement="top">
      <n-form-item label="当前模型大小缩放">
        <n-space align="center" style="width: 100%;">
          <n-slider
            :value="currentModelScaleValue"
            :min="0.1"
            :max="5.0"
            :step="0.05"
            style="width: 200px;"
            @update:value="handleModelScaleChange"
          />
          <n-input-number
            :value="currentModelScaleValue"
            :min="0.1"
            :max="5.0"
            :step="0.05"
            size="small"
            style="width: 110px;"
            @update:value="(value: number | null) => handleModelScaleChange(value || 1.0)"
          >
            <template #suffix>x</template>
          </n-input-number>
          <n-button size="small" @click="handleResetModelScale">重置</n-button>
        </n-space>
      </n-form-item>
      <n-form-item label="主题色跟随当前模型">
        <n-switch v-model:value="advancedSettings.themeFollowModel" @update:value="handleThemeFollowChange" />
        <template #feedback>
          启用后，界面主题会跟随当前模型配色；关闭后将保留手动或已有主题设置。
        </template>
      </n-form-item>
    </n-form>

    <div class="settings-kv-list">
      <div class="settings-kv-list__row">
        <span>当前主题色</span>
        <strong>{{ sourceColor.toUpperCase() }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>同步状态</span>
        <strong>{{ advancedSettings.themeFollowModel ? (currentModelPath ? '跟随当前模型' : '等待模型加载') : '已关闭自动同步' }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useAdvancedSettingsDomain } from '../domains/createAdvancedSettingsDomain'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'

const { advancedSettings, handleThemeFollowChange } = useAdvancedSettingsDomain()
const {
  currentModelDisplay,
  currentModelInitial,
  currentModelPath,
  currentModelScaleValue,
  currentModelStatusClass,
  currentModelStatusLabel,
  handleModelScaleChange,
  handleResetModelScale,
  sourceColor,
  themeSwatchStyle,
} = useModelSettingsDomain()
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
</style>
