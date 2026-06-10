<template>
  <n-modal
    v-model:show="visible"
    :mask-closable="true"
    transform-origin="center"
    @after-leave="query = ''"
  >
    <div
      class="settings-command-palette window-no-drag"
      role="dialog"
      :aria-label="$t('settings.search.placeholder')"
    >
      <div class="settings-command-palette__input-wrap">
        <Search :size="18" class="settings-command-palette__icon" />
        <input
          ref="inputRef"
          v-model="query"
          class="settings-command-palette__input"
          type="text"
          :placeholder="$t('settings.search.placeholder')"
          @keydown.down.prevent="moveHighlight(1)"
          @keydown.up.prevent="moveHighlight(-1)"
          @keydown.enter.prevent="selectHighlighted"
          @keydown.esc="visible = false"
        />
      </div>

      <ul class="settings-command-palette__list" role="listbox">
        <li
          v-for="(item, index) in filtered"
          :key="item.id"
          class="settings-command-palette__item"
          :class="{ 'settings-command-palette__item--active': index === highlightIndex }"
          role="option"
          @mouseenter="highlightIndex = index"
          @click="selectItem(item)"
        >
          <span class="settings-command-palette__item-title">{{ item.title }}</span>
          <span class="settings-command-palette__item-group">{{
            $t(`settings.menu.groupLabel.${item.group}`)
          }}</span>
        </li>
        <li v-if="filtered.length === 0" class="settings-command-palette__empty">
          {{ $t('settings.search.noResults') }}
        </li>
      </ul>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import {
  useSettingsSearchIndex,
  type SettingsSearchItem
} from '../composables/useSettingsSearchIndex'
import type { SettingsChildKey, SettingsGroupKey } from '../settingsMenu'

const visible = defineModel<boolean>('show', { required: true })

const emit = defineEmits<{
  (event: 'select', group: SettingsGroupKey, child: SettingsChildKey): void
}>()

const { filterItems } = useSettingsSearchIndex()
const query = ref('')
const highlightIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const filtered = computed(() => filterItems(query.value))

watch(query, () => {
  highlightIndex.value = 0
})

watch(visible, async open => {
  if (open) {
    highlightIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

function moveHighlight(delta: number) {
  if (filtered.value.length === 0) {
    return
  }

  highlightIndex.value =
    (highlightIndex.value + delta + filtered.value.length) % filtered.value.length
}

function selectItem(item: SettingsSearchItem) {
  emit('select', item.group, item.child)
  visible.value = false
}

function selectHighlighted() {
  const item = filtered.value[highlightIndex.value]
  if (item) {
    selectItem(item)
  }
}
</script>

<style scoped>
.settings-command-palette {
  width: min(480px, 92vw);
  padding: 0;
  border-radius: 14px;
  border: 1px solid var(--settings-border);
  background: var(--settings-bg-elevated);
  box-shadow: var(--settings-shadow);
  overflow: hidden;
}

.settings-command-palette__input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--settings-border);
}

.settings-command-palette__icon {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.settings-command-palette__input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  color: var(--color-text-primary);
  outline: none;
}

.settings-command-palette__list {
  list-style: none;
  margin: 0;
  padding: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.settings-command-palette__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.settings-command-palette__item:hover,
.settings-command-palette__item--active {
  background: var(--settings-bg-active);
}

.settings-command-palette__item-title {
  font-size: 13px;
  font-weight: 600;
}

.settings-command-palette__item-group {
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.settings-command-palette__empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-tertiary);
}
</style>
