<template>
  <SettingsPageScaffold>
    <SettingsSubsection :title="$t('settings.advanced.personality.title')">
      <n-alert type="info" :bordered="false">
        {{ $t('settings.advanced.personality.description') }}
      </n-alert>

      <n-form class="personality-form" label-placement="top" :disabled="loading">
        <div class="personality-grid">
          <n-form-item :label="$t('settings.advanced.personality.enabled')">
            <n-switch v-model:value="form.enabled" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.personality.injectIntoMessages')">
            <n-switch v-model:value="form.injectIntoMessages" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.personality.allowDesktopInterruption')">
            <n-switch v-model:value="form.allowDesktopInterruption" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.personality.allowScreenshot')">
            <n-switch v-model:value="form.allowScreenshot" @update:value="save" />
          </n-form-item>
        </div>

        <n-form-item :label="$t('settings.advanced.personality.exclusiveNickname')">
          <n-input v-model:value="form.exclusiveNickname" @blur="save" />
        </n-form-item>

        <div class="personality-grid">
          <n-form-item :label="$t('settings.advanced.personality.proactiveLevel')">
            <n-slider v-model:value="form.proactiveLevel" :min="0" :max="100" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.personality.sarcasm')">
            <n-slider v-model:value="form.sarcasm" :min="0" :max="100" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.personality.affection')">
            <n-slider v-model:value="form.affection" :min="0" :max="100" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.personality.professionalism')">
            <n-slider v-model:value="form.professionalism" :min="0" :max="100" @update:value="save" />
          </n-form-item>
          <n-form-item :label="$t('settings.advanced.personality.roastFrequency')">
            <n-slider v-model:value="form.roastFrequency" :min="0" :max="100" @update:value="save" />
          </n-form-item>
        </div>

        <n-form-item :label="$t('settings.advanced.personality.likedTopics')">
          <n-dynamic-tags v-model:value="form.likedTopics" @update:value="save" />
        </n-form-item>

        <n-form-item :label="$t('settings.advanced.personality.blockedTopics')">
          <n-dynamic-tags v-model:value="form.blockedTopics" @update:value="save" />
        </n-form-item>

        <div class="personality-actions">
          <n-button :loading="loading" @click="load">{{ $t('common.refresh') }}</n-button>
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

const loading = ref(false)
const form = reactive<PersonalitySettings>({
  enabled: true,
  injectIntoMessages: true,
  proactiveLevel: 45,
  sarcasm: 15,
  affection: 35,
  professionalism: 60,
  roastFrequency: 20,
  allowDesktopInterruption: true,
  allowScreenshot: true,
  exclusiveNickname: '',
  likedTopics: [],
  blockedTopics: []
})

const apply = (settings: PersonalitySettings) => Object.assign(form, settings)

const load = async () => {
  loading.value = true
  try {
    apply(await window.electron.personality.getSettings())
  } finally {
    loading.value = false
  }
}

const save = async () => {
  apply(await window.electron.personality.updateSettings({ ...form }))
}

const reset = async () => {
  loading.value = true
  try {
    apply(await window.electron.personality.resetSettings())
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.personality-form {
  margin-top: 16px;
}

.personality-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
}

.personality-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
