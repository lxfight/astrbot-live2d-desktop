<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>模型库</h2>
      <n-button type="primary" size="small" @click="handleImportModel">导入模型</n-button>
    </div>
    <p class="settings-section__desc">管理本地 Live2D 模型文件。共 {{ modelList.length }} 个模型。</p>

    <div v-if="modelList.length > 0" class="model-grid">
      <article
        v-for="model in modelList"
        :key="model.name"
        class="model-card"
        :class="{ 'model-card--active': currentModelPath === model.path }"
      >
        <div class="model-card__top">
          <div class="model-card__preview" :style="getModelPreviewStyle(model.path)">
            <span>{{ model.name.slice(0, 1).toUpperCase() }}</span>
          </div>
          <span v-if="currentModelPath === model.path" class="model-card__badge">当前</span>
        </div>
        <div class="model-card__body">
          <strong>{{ model.name }}</strong>
          <code>{{ model.path }}</code>
        </div>
        <div class="model-card__actions">
          <n-button size="small" type="primary" @click="handleLoadModel(model.path)">
            {{ currentModelPath === model.path ? '重新加载' : '加载' }}
          </n-button>
          <n-button size="small" tertiary type="error" @click="handleDeleteModel(model.name)">删除</n-button>
        </div>
      </article>
    </div>
    <n-empty v-else description="暂无模型，请先导入" />
  </section>
</template>

<script setup lang="ts">
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'

const {
  currentModelPath,
  getModelPreviewStyle,
  handleDeleteModel,
  handleImportModel,
  handleLoadModel,
  modelList,
} = useModelSettingsDomain()
</script>

<style scoped>
.model-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: var(--desktop-radius-panel);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 34%), rgba(255, 255, 255, 0.02);
  border: 1px solid var(--desktop-panel-border);
  transition: all var(--duration-fast) var(--ease-out);
}

.model-card:hover {
  border-color: rgba(var(--color-accent-rgb), 0.22);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
}

.model-card--active {
  border-color: rgba(var(--color-accent-rgb), 0.32);
  background: linear-gradient(180deg, rgba(var(--color-accent-rgb), 0.08), transparent 30%), rgba(255, 255, 255, 0.024);
}

.model-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.14);
  border: 1px solid rgba(var(--color-accent-rgb), 0.28);
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: 600;
}

.model-card__body {
  min-width: 0;
}

.model-card__body strong {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
}

.model-card__body code {
  display: block;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  font-size: 11px;
  word-break: break-all;
}

.model-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
