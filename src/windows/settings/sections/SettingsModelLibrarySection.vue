<template>
  <SettingsPageScaffold>
    <div class="model-library">
      <div class="model-library__toolbar">
        <div class="model-library__toolbar-actions">
          <n-button type="primary" size="small" @click="handleImportModel">{{
            $t('settings.model.library.importModel')
          }}</n-button>
          <n-button size="small" @click="handleBatchImportModels">{{
            $t('settings.model.library.batchImport')
          }}</n-button>
        </div>
        <span class="model-library__count">{{
          $t('settings.model.library.modelCount', { count: modelList.length })
        }}</span>
      </div>

      <div v-if="recentModels.length > 0" class="model-recent">
        <span class="model-recent__title">{{ $t('settings.model.library.recentTitle') }}</span>
        <div class="model-recent__list">
          <n-tag
            v-for="recent in recentModels"
            :key="recent.path"
            size="small"
            closable
            :type="currentModelPath === recent.path ? 'success' : 'default'"
            class="model-recent__tag"
            @click="handleLoadModel(recent.path)"
            @close.stop="handleRemoveRecent(recent.path)"
          >
            {{ recent.name }}
          </n-tag>
        </div>
      </div>
      <p v-else-if="modelList.length === 0" class="model-library__hint">
        {{ $t('settings.model.library.recentEmpty') }}
      </p>

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
              v-if="currentModelPath === model.path"
              size="small"
              @click.stop="handleSavePreset(model.path)"
            >
              {{ $t('settings.model.presets.savePreset') }}
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

    <n-modal
      v-model:show="showSavePresetModal"
      preset="dialog"
      :title="$t('settings.model.presets.savePreset')"
    >
      <n-form :model="savePresetForm" label-placement="left" label-width="100">
        <n-form-item :label="$t('settings.model.presets.presetName')">
          <n-input
            v-model:value="savePresetForm.presetName"
            :placeholder="$t('settings.model.presets.presetNamePlaceholder')"
          />
        </n-form-item>
        <n-form-item :label="$t('settings.model.presets.notes')">
          <n-input
            v-model:value="savePresetForm.notes"
            type="textarea"
            :placeholder="$t('settings.model.presets.notesPlaceholder')"
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showSavePresetModal = false">{{ $t('dialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleConfirmSavePreset">{{
          $t('dialog.confirm')
        }}</n-button>
      </template>
    </n-modal>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'
import { useModelStore } from '../../../stores/model'

const { t } = useI18n()
const message = useMessage()
const modelStore = useModelStore()

const {
  currentModelPath,
  getModelPreviewStyle,
  handleBatchImportModels,
  handleDeleteModel,
  handleImportModel,
  handleLoadModel,
  modelList
} = useModelSettingsDomain()

const recentModels = computed(() =>
  modelStore.recentModelPaths
    .map(path => {
      const matched = modelList.value.find(model => model.path === path)
      return { path, name: matched?.name || path.split('/').pop() || path }
    })
    .filter(entry => entry.path !== currentModelPath.value)
)

function handleRemoveRecent(path: string) {
  modelStore.removeRecentModel(path)
}

const showSavePresetModal = ref(false)
const savePresetForm = ref({
  modelPath: '',
  presetName: '',
  notes: ''
})

async function handleSavePreset(modelPath: string) {
  savePresetForm.value = {
    modelPath,
    presetName: modelPath.split('/').pop() || 'preset',
    notes: ''
  }
  showSavePresetModal.value = true
}

async function handleConfirmSavePreset() {
  try {
    const modelPath = savePresetForm.value.modelPath
    const behavior = modelStore.getModelBehavior(modelPath)
    const scale = modelStore.getModelScale(modelPath)
    const position = modelStore.getModelPosition(modelPath)

    const result = await window.electron.modelPresets.save(
      savePresetForm.value.presetName,
      modelPath,
      behavior.idleActivity,
      behavior.persistentExpressions,
      scale,
      position?.x,
      position?.y,
      savePresetForm.value.notes
    )

    if (result.success) {
      message.success(t('settings.model.presets.saveSuccess'))
      showSavePresetModal.value = false
    } else {
      message.error(t('settings.model.presets.saveFailed'))
    }
  } catch {
    message.error(t('settings.model.presets.saveFailed'))
  }
}
</script>

<style scoped>
.model-library__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.model-library__toolbar-actions {
  display: flex;
  gap: 8px;
}

.model-library__count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.model-library__hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-bottom: 14px;
}

.model-recent {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.model-recent__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  line-height: 22px;
}

.model-recent__list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.model-recent__tag {
  cursor: pointer;
}

.model-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: var(--settings-bg-content);
  border: 1px solid var(--settings-border);
  box-shadow: var(--settings-shadow-soft);
  transition:
    transform var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.model-card:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--color-accent-rgb), 0.32);
  box-shadow: var(--settings-shadow);
}

.model-card--current {
  border-color: rgba(var(--color-accent-rgb), 0.42);
  box-shadow:
    0 0 0 1px rgba(var(--color-accent-rgb), 0.22),
    var(--settings-shadow);
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
  border-radius: 11px;
  color: var(--theme-accent-contrast);
  font-size: 18px;
  font-weight: 700;
}

.model-card__badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--settings-bg-active);
  color: var(--color-accent);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.model-card__body strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 5px;
  color: var(--color-text-primary);
  line-height: 1.35;
}

.model-card__path {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-tertiary);
  word-break: break-all;
  line-height: 1.5;
}

.model-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 2px;
}
</style>
