<template>
  <SettingsPageScaffold>
    <div class="model-presets">
      <div class="model-presets__toolbar">
        <n-input
          v-model:value="searchQuery"
          size="small"
          :placeholder="$t('settings.model.presets.search')"
          clearable
        >
          <template #prefix>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </template>
        </n-input>
        <n-select
          v-model:value="selectedModelPath"
          size="small"
          :placeholder="$t('settings.model.presets.filterByModel')"
          :options="modelPathOptions"
          clearable
          style="width: 240px"
        />
        <span class="model-presets__count">{{
          $t('settings.model.presets.count', { count: filteredPresets.length })
        }}</span>
      </div>

      <div v-if="filteredPresets.length > 0" class="presets-list">
        <article v-for="preset in filteredPresets" :key="preset.id" class="preset-card">
          <div class="preset-card__header">
            <strong>{{ preset.presetName }}</strong>
            <div class="preset-card__actions">
              <n-button size="small" type="primary" @click="handleApplyPreset(preset)">
                {{ $t('settings.model.presets.load') }}
              </n-button>
              <n-button size="small" @click="handleEditPreset(preset)">
                {{ $t('settings.model.presets.edit') }}
              </n-button>
              <n-button
                size="small"
                tertiary
                type="error"
                @click="handleDeletePreset(preset.presetName)"
              >
                {{ $t('settings.model.presets.delete') }}
              </n-button>
            </div>
          </div>
          <div class="preset-card__body">
            <code class="preset-card__path">{{ preset.modelPath }}</code>
            <div class="preset-card__config">
              <div class="preset-card__config-item">
                <span class="preset-card__config-label">{{
                  $t('settings.model.presets.idleActivity')
                }}</span>
                <span>{{ preset.idleActivity }}</span>
              </div>
              <div
                v-if="preset.persistentExpressions && preset.persistentExpressions.length > 0"
                class="preset-card__config-item"
              >
                <span class="preset-card__config-label">{{
                  $t('settings.model.presets.persistentExpressions')
                }}</span>
                <span>{{ preset.persistentExpressions.join(', ') }}</span>
              </div>
              <div v-if="preset.scale != null" class="preset-card__config-item">
                <span class="preset-card__config-label">{{
                  $t('settings.model.presets.scale')
                }}</span>
                <span>{{ preset.scale.toFixed(2) }}</span>
              </div>
              <div
                v-if="preset.positionX != null && preset.positionY != null"
                class="preset-card__config-item"
              >
                <span class="preset-card__config-label">{{
                  $t('settings.model.presets.position')
                }}</span>
                <span>({{ preset.positionX.toFixed(0) }}, {{ preset.positionY.toFixed(0) }})</span>
              </div>
            </div>
            <p v-if="preset.notes" class="preset-card__notes">{{ preset.notes }}</p>
            <div class="preset-card__meta">
              <span
                >{{ $t('settings.model.presets.createdAt') }}:
                {{ formatDate(preset.createdAt) }}</span
              >
              <span v-if="preset.updatedAt !== preset.createdAt">
                {{ $t('settings.model.presets.updatedAt') }}: {{ formatDate(preset.updatedAt) }}
              </span>
            </div>
          </div>
        </article>
      </div>
      <n-empty v-else :description="$t('settings.model.presets.empty')" />
    </div>

    <n-modal
      v-model:show="showEditModal"
      preset="dialog"
      :title="$t('settings.model.presets.edit')"
    >
      <n-form v-if="editingPreset" :model="editForm" label-placement="left" label-width="80">
        <n-form-item :label="$t('settings.model.presets.notes')">
          <n-input
            v-model:value="editForm.notes"
            type="textarea"
            :placeholder="$t('settings.model.presets.notesPlaceholder')"
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showEditModal = false">{{ $t('dialog.cancel') }}</n-button>
        <n-button type="primary" @click="handleSaveEdit">{{ $t('dialog.confirm') }}</n-button>
      </template>
    </n-modal>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import { useModelStore } from '../../../stores/model'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const modelStore = useModelStore()

interface ModelPreset {
  id: number
  presetName: string
  modelPath: string
  idleActivity: number
  persistentExpressions: string[]
  scale?: number
  positionX?: number
  positionY?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

interface EditForm {
  notes: string
}

const presets = ref<ModelPreset[]>([])
const searchQuery = ref('')
const selectedModelPath = ref<string | null>(null)
const showEditModal = ref(false)
const editingPreset = ref<ModelPreset | null>(null)
const editForm = ref<EditForm>({
  notes: ''
})

const modelPathOptions = computed(() => {
  const paths = new Set<string>()
  presets.value.forEach(preset => paths.add(preset.modelPath))
  return Array.from(paths).map(path => ({
    label: path.split('/').pop() || path,
    value: path
  }))
})

const filteredPresets = computed(() => {
  let result = presets.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      preset =>
        preset.presetName.toLowerCase().includes(query) ||
        preset.modelPath.toLowerCase().includes(query) ||
        preset.notes?.toLowerCase().includes(query)
    )
  }

  if (selectedModelPath.value) {
    result = result.filter(preset => preset.modelPath === selectedModelPath.value)
  }

  return result
})

async function loadPresets() {
  try {
    const result = await window.electron.modelPresets.getAll()
    if (result.success) {
      presets.value = result.presets
    } else {
      message.error(t('settings.model.presets.saveFailed'))
    }
  } catch {
    message.error(t('settings.model.presets.saveFailed'))
  }
}

async function handleApplyPreset(preset: ModelPreset) {
  try {
    modelStore.setModelIdleActivity(preset.idleActivity, preset.modelPath)
    modelStore.setModelPersistentExpressions([...preset.persistentExpressions], preset.modelPath)

    if (preset.scale != null) {
      modelStore.setModelScale(preset.scale, preset.modelPath)
    }

    if (preset.positionX != null && preset.positionY != null) {
      modelStore.setModelPosition(preset.positionX, preset.positionY)
    }

    message.success(t('settings.model.presets.loadSuccess'))
  } catch {
    message.error(t('settings.model.presets.loadFailed'))
  }
}

function handleEditPreset(preset: ModelPreset) {
  editingPreset.value = preset
  editForm.value = {
    notes: preset.notes || ''
  }
  showEditModal.value = true
}

async function handleSaveEdit() {
  if (!editingPreset.value) return

  try {
    const result = await window.electron.modelPresets.updateNotes(
      editingPreset.value.presetName,
      editForm.value.notes
    )

    if (result.success) {
      message.success(t('settings.model.presets.updateSuccess'))
      showEditModal.value = false
      await loadPresets()
    } else {
      message.error(t('settings.model.presets.updateFailed'))
    }
  } catch {
    message.error(t('settings.model.presets.updateFailed'))
  }
}

function handleDeletePreset(presetName: string) {
  dialog.warning({
    title: t('dialog.confirm'),
    content: t('settings.model.presets.deleteConfirm', { name: presetName }),
    positiveText: t('dialog.confirm'),
    negativeText: t('dialog.cancel'),
    onPositiveClick: async () => {
      try {
        const result = await window.electron.modelPresets.delete(presetName)
        if (result.success) {
          message.success(t('settings.model.presets.deleteSuccess'))
          await loadPresets()
        } else {
          message.error(t('settings.model.presets.deleteFailed'))
        }
      } catch {
        message.error(t('settings.model.presets.deleteFailed'))
      }
    }
  })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString()
}

onMounted(() => {
  loadPresets()
})
</script>

<style scoped>
.model-presets {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.model-presets__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.model-presets__toolbar .n-input {
  flex: 1;
  min-width: 200px;
}

.model-presets__count {
  font-size: 13px;
  color: var(--text-3);
  white-space: nowrap;
}

.presets-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preset-card {
  background: var(--card-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.preset-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.preset-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preset-card__header strong {
  font-size: 15px;
  color: var(--text-1);
}

.preset-card__actions {
  display: flex;
  gap: 8px;
}

.preset-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-card__path {
  font-size: 12px;
  color: var(--text-3);
  background: var(--code-color);
  padding: 4px 8px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-card__config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.preset-card__config-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.preset-card__config-label {
  color: var(--text-2);
  font-weight: 500;
  min-width: 100px;
}

.preset-card__notes {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
  margin: 0;
  padding: 8px;
  background: var(--hover-color);
  border-radius: 4px;
}

.preset-card__meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-3);
  padding-top: 8px;
  border-top: 1px solid var(--divider-color);
}
</style>
