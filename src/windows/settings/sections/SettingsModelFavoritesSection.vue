<template>
  <SettingsPageScaffold>
    <div class="model-favorites">
      <div class="model-favorites__toolbar">
        <n-input
          v-model:value="searchQuery"
          size="small"
          :placeholder="$t('settings.model.favorites.search')"
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
          v-model:value="selectedTag"
          size="small"
          :placeholder="$t('settings.model.favorites.filterByTag')"
          :options="tagOptions"
          clearable
          style="width: 180px"
        />
        <span class="model-favorites__count">{{
          $t('settings.model.favorites.count', { count: filteredFavorites.length })
        }}</span>
      </div>

      <div v-if="filteredFavorites.length > 0" class="model-grid">
        <article
          v-for="favorite in filteredFavorites"
          :key="favorite.modelPath"
          class="model-card"
          :class="{ 'model-card--current': currentModelPath === favorite.modelPath }"
        >
          <div class="model-card__top">
            <div class="model-card__preview" :style="getModelPreviewStyle(favorite.modelPath)">
              <span>{{
                (favorite.displayName || favorite.modelPath)
                  .split('/')
                  .pop()
                  ?.slice(0, 1)
                  .toUpperCase()
              }}</span>
            </div>
            <span v-if="currentModelPath === favorite.modelPath" class="model-card__badge">{{
              $t('settings.model.favorites.current')
            }}</span>
          </div>
          <div class="model-card__body">
            <strong>{{ favorite.displayName || favorite.modelPath.split('/').pop() }}</strong>
            <code class="model-card__path">{{ favorite.modelPath }}</code>
            <p v-if="favorite.notes" class="model-card__notes">{{ favorite.notes }}</p>
            <div v-if="favorite.tags && favorite.tags.length > 0" class="model-card__tags">
              <span
                v-for="tag in favorite.tags"
                :key="tag"
                class="model-card__tag"
                @click.stop="selectedTag = tag"
                >{{ tag }}</span
              >
            </div>
          </div>
          <div class="model-card__actions">
            <n-button size="small" type="primary" @click.stop="handleLoadModel(favorite.modelPath)">
              {{
                currentModelPath === favorite.modelPath
                  ? $t('settings.model.favorites.reload')
                  : $t('settings.model.favorites.load')
              }}
            </n-button>
            <n-button size="small" @click.stop="handleEditFavorite(favorite)">{{
              $t('settings.model.favorites.edit')
            }}</n-button>
            <n-button
              size="small"
              tertiary
              type="error"
              @click.stop="handleRemoveFavorite(favorite.modelPath)"
              >{{ $t('settings.model.favorites.remove') }}</n-button
            >
          </div>
        </article>
      </div>
      <n-empty v-else :description="$t('settings.model.favorites.empty')" />
    </div>

    <n-modal
      v-model:show="showEditModal"
      preset="dialog"
      :title="$t('settings.model.favorites.edit')"
    >
      <n-form v-if="editingFavorite" :model="editForm" label-placement="left" label-width="80">
        <n-form-item :label="$t('settings.model.favorites.displayName')">
          <n-input
            v-model:value="editForm.displayName"
            :placeholder="$t('settings.model.favorites.displayNamePlaceholder')"
          />
        </n-form-item>
        <n-form-item :label="$t('settings.model.favorites.notes')">
          <n-input
            v-model:value="editForm.notes"
            type="textarea"
            :placeholder="$t('settings.model.favorites.notesPlaceholder')"
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
        </n-form-item>
        <n-form-item :label="$t('settings.model.favorites.tags')">
          <n-dynamic-tags v-model:value="editForm.tags" />
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
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'

const { t } = useI18n()
const message = useMessage()
const { currentModelPath, getModelPreviewStyle, handleLoadModel } = useModelSettingsDomain()

interface ModelFavorite {
  id: number
  modelPath: string
  displayName?: string | null
  notes?: string | null
  addedAt: string
  tags?: string[]
}

interface EditForm {
  displayName: string
  notes: string
  tags: string[]
}

const favorites = ref<ModelFavorite[]>([])
const searchQuery = ref('')
const selectedTag = ref<string | null>(null)
const showEditModal = ref(false)
const editingFavorite = ref<ModelFavorite | null>(null)
const editForm = ref<EditForm>({
  displayName: '',
  notes: '',
  tags: []
})

const tagOptions = computed(() => {
  const allTags = new Set<string>()
  favorites.value.forEach(fav => {
    if (fav.tags) {
      fav.tags.forEach(tag => allTags.add(tag))
    }
  })
  return Array.from(allTags).map(tag => ({ label: tag, value: tag }))
})

const filteredFavorites = computed(() => {
  let result = favorites.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      fav =>
        fav.displayName?.toLowerCase().includes(query) ||
        fav.modelPath.toLowerCase().includes(query) ||
        fav.notes?.toLowerCase().includes(query)
    )
  }

  if (selectedTag.value) {
    result = result.filter(fav => fav.tags?.includes(selectedTag.value!))
  }

  return result
})

async function loadFavorites() {
  try {
    const result = await window.electron.modelFavorites.getAll()
    if (result.success) {
      const favoritesWithTags = await Promise.all(
        result.favorites.map(async fav => {
          const tagsResult = await window.electron.modelFavorites.getTags(fav.modelPath)
          return {
            ...fav,
            tags: tagsResult.success ? tagsResult.tags : []
          }
        })
      )
      favorites.value = favoritesWithTags
    } else {
      message.error(t('toast.favoriteLoadFailed'))
    }
  } catch {
    message.error(t('toast.favoriteLoadFailed'))
  }
}

function handleEditFavorite(favorite: ModelFavorite) {
  editingFavorite.value = favorite
  editForm.value = {
    displayName: favorite.displayName || '',
    notes: favorite.notes || '',
    tags: favorite.tags || []
  }
  showEditModal.value = true
}

async function handleSaveEdit() {
  if (!editingFavorite.value) return

  try {
    const result = await window.electron.modelFavorites.update(
      editingFavorite.value.modelPath,
      editForm.value.displayName || undefined,
      editForm.value.notes || undefined
    )

    if (result.success) {
      const existingTags = editingFavorite.value.tags || []
      const newTags = editForm.value.tags

      const tagsToAdd = newTags.filter(tag => !existingTags.includes(tag))
      const tagsToRemove = existingTags.filter(tag => !newTags.includes(tag))

      for (const tag of tagsToAdd) {
        await window.electron.modelFavorites.addTag(editingFavorite.value.modelPath, tag)
      }

      for (const tag of tagsToRemove) {
        await window.electron.modelFavorites.removeTag(editingFavorite.value.modelPath, tag)
      }

      message.success(t('toast.favoriteUpdated'))
      showEditModal.value = false
      await loadFavorites()
    } else {
      message.error(t('toast.favoriteUpdateFailed', { error: result.error }))
    }
  } catch (error) {
    message.error(
      t('toast.favoriteUpdateFailed', {
        error: error instanceof Error ? error.message : String(error)
      })
    )
  }
}

async function handleRemoveFavorite(modelPath: string) {
  try {
    const result = await window.electron.modelFavorites.remove(modelPath)
    if (result.success) {
      message.success(t('toast.favoriteRemoved'))
      await loadFavorites()
    } else {
      message.error(t('toast.favoriteRemoveFailed', { error: result.error }))
    }
  } catch (error) {
    message.error(
      t('toast.favoriteRemoveFailed', {
        error: error instanceof Error ? error.message : String(error)
      })
    )
  }
}

onMounted(() => {
  loadFavorites()
})
</script>

<style scoped>
.model-favorites__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.model-favorites__count {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
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

.model-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.model-card__body strong {
  font-size: 14px;
  color: var(--color-text-primary);
}

.model-card__path {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-family: var(--font-code);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-card__notes {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 4px 0 0 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.model-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.model-card__tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--settings-bg-hover);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.model-card__tag:hover {
  background: var(--settings-bg-active);
  color: var(--color-accent);
}

.model-card__actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--settings-border);
}

.model-card__actions .n-button {
  flex: 1;
}
</style>
