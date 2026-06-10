<template>
  <SettingsPageScaffold>
    <div class="model-library">
      <div class="model-library__toolbar">
        <n-button type="primary" size="small" @click="handleImportModel">{{
          $t('settings.model.library.importModel')
        }}</n-button>
        <span class="model-library__count">{{
          $t('settings.model.library.modelCount', { count: modelList.length })
        }}</span>
      </div>

      <div v-if="modelList.length > 0" class="model-grid">
        <article
          v-for="model in modelList"
          :key="model.name"
          class="model-card"
          :class="{ 'model-card--current': currentModelPath === model.path }"
        >
          <div class="model-card__top">
            <div class="model-card__preview" :style="getModelPreviewStyle(model.path)">
              <span>{{ model.name.slice(0, 1).toUpperCase() }}</span>
            </div>
            <span v-if="currentModelPath === model.path" class="model-card__badge">{{
              $t('settings.model.library.current')
            }}</span>
          </div>
          <div class="model-card__body">
            <strong>{{ model.name }}</strong>
            <code class="model-card__path">{{ model.path }}</code>
          </div>
          <div class="model-card__actions">
            <n-button size="small" type="primary" @click.stop="handleLoadModel(model.path)">
              {{
                currentModelPath === model.path
                  ? $t('settings.model.library.reload')
                  : $t('settings.model.library.load')
              }}
            </n-button>
            <n-button
              size="small"
              tertiary
              type="error"
              @click.stop="handleDeleteModel(model.name)"
              >{{ $t('settings.model.library.delete') }}</n-button
            >
          </div>
        </article>
      </div>
      <n-empty v-else :description="$t('settings.model.library.empty')" />
    </div>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'

const {
  currentModelPath,
  getModelPreviewStyle,
  handleDeleteModel,
  handleImportModel,
  handleLoadModel,
  modelList
} = useModelSettingsDomain()
</script>

<style scoped>
.model-library__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.model-library__count {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.model-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: var(--desktop-radius-panel);
  background: var(--desktop-panel-bg);
  border: 1px solid var(--desktop-panel-border);
  box-shadow: var(--settings-shadow);
  transition: transform var(--duration-fast) var(--ease-out);
}

.model-card:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--color-accent-rgb), 0.28);
}

.model-card--current {
  border-color: rgba(var(--color-accent-rgb), 0.4);
  box-shadow: 0 0 0 1px rgba(var(--color-accent-rgb), 0.2);
}

.model-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.model-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  color: var(--theme-accent-contrast);
  font-size: 18px;
  font-weight: 700;
}

.model-card__badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--settings-bg-active);
  color: var(--color-accent);
  font-weight: 600;
}

.model-card__body strong {
  display: block;
  font-size: 14px;
  margin-bottom: 6px;
}

.model-card__path {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-tertiary);
  word-break: break-all;
  line-height: 1.45;
}

.model-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}
</style>
