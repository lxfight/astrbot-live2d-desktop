<template>
  <SettingsPageScaffold>
    <SettingsSubsection :title="$t('settings.advanced.scenePro.title')">
      <n-alert type="info" :bordered="false">
        {{ $t('settings.advanced.scenePro.description') }}
      </n-alert>

      <n-form class="scene-form" label-placement="top" :disabled="loading">
        <div class="scene-grid">
          <n-form-item :label="$t('settings.advanced.scenePro.enabled')">
            <n-switch v-model:value="form.enabled" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.scenePro.includeInPrompt')">
            <n-switch v-model:value="form.includeInPrompt" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.scenePro.adaptiveSuggestion')">
            <n-switch v-model:value="form.adaptiveSuggestion" @update:value="save" />
          </n-form-item>
        </div>

        <n-form-item :label="$t('settings.advanced.scenePro.quietScenes')">
          <n-select
            v-model:value="form.quietScenes"
            multiple
            :options="sceneOptions"
            @update:value="save"
          />
        </n-form-item>

        <n-form-item :label="$t('settings.advanced.scenePro.activeScenes')">
          <n-select
            v-model:value="form.activeScenes"
            multiple
            :options="sceneOptions"
            @update:value="save"
          />
        </n-form-item>

        <n-card v-if="snapshot" size="small" embedded>
          <template #header>{{ $t('settings.advanced.scenePro.snapshot') }}</template>
          <p>{{ $t('settings.advanced.scenePro.scene') }}: {{ snapshot.scene.label }}</p>
          <p>{{ $t('settings.advanced.scenePro.reason') }}: {{ snapshot.scene.suggestion }}</p>
          <p v-if="snapshot.current">
            {{ $t('settings.advanced.scenePro.currentWindow') }}:
            {{ formatCurrentWindow(snapshot.current) }}
          </p>
        </n-card>

        <div class="scene-actions">
          <n-button :loading="loading" @click="load">{{ $t('common.refresh') }}</n-button>
          <n-button :loading="snapshotLoading" @click="loadSnapshot">
            {{ $t('settings.advanced.scenePro.getSnapshot') }}
          </n-button>
          <n-button type="warning" ghost :loading="loading" @click="reset">
            {{ $t('common.reset') }}
          </n-button>
        </div>
      </n-form>
    </SettingsSubsection>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import SettingsSubsection from '../shared/SettingsSubsection.vue'

type SceneSnapshot = Awaited<ReturnType<typeof window.electron.desktopScene.getSnapshot>>

const loading = ref(false)
const snapshotLoading = ref(false)
const snapshot = ref<SceneSnapshot | null>(null)

const sceneOptions = [
  { label: 'Code', value: 'code' },
  { label: 'Game', value: 'game' },
  { label: 'Chat', value: 'chat' },
  { label: 'Browser', value: 'browser' },
  { label: 'Media', value: 'media' },
  { label: 'Art', value: 'art' },
  { label: 'Study', value: 'study' },
  { label: 'General', value: 'general' }
]

const form = reactive<DesktopSceneSettings>({
  enabled: true,
  includeInPrompt: true,
  adaptiveSuggestion: true,
  quietScenes: ['game', 'media'],
  activeScenes: ['code', 'art', 'study']
})

const apply = (settings: DesktopSceneSettings) => Object.assign(form, settings)

const load = async () => {
  loading.value = true
  try {
    apply(await window.electron.desktopScene.getSettings())
  } finally {
    loading.value = false
  }
}

const save = async () => {
  apply(await window.electron.desktopScene.updateSettings({ ...form }))
}

const reset = async () => {
  loading.value = true
  try {
    apply(await window.electron.desktopScene.resetSettings())
    snapshot.value = null
  } finally {
    loading.value = false
  }
}

const loadSnapshot = async () => {
  snapshotLoading.value = true
  try {
    snapshot.value = await window.electron.desktopScene.getSnapshot()
  } finally {
    snapshotLoading.value = false
  }
}

const formatCurrentWindow = (value: unknown) => {
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  const app = record.app as Record<string, unknown> | undefined
  const windowInfo = record.window as Record<string, unknown> | undefined
  return [app?.name, app?.processName, windowInfo?.title ?? record.windowTitle].filter(Boolean).join(' / ')
}

onMounted(load)
</script>

<style scoped>
.scene-form {
  margin-top: 16px;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
}

.scene-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
