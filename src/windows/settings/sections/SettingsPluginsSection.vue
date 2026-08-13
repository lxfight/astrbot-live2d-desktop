<template>
  <SettingsPageScaffold>
    <div class="plugins">
      <div class="plugins__toolbar">
        <n-button size="small" :loading="loading" @click="loadPlugins">
          {{ $t('settings.plugins.refresh') }}
        </n-button>
        <n-button size="small" type="primary" @click="handleInstall">
          {{ $t('settings.plugins.install') }}
        </n-button>
      </div>

      <n-skeleton v-if="loading && plugins.length === 0" text :repeat="3" />

      <div v-else-if="plugins.length > 0" class="plugins__list">
        <article v-for="plugin in plugins" :key="plugin.manifest.id" class="plugin-card">
          <div class="plugin-card__header">
            <div class="plugin-card__identity">
              <strong>{{ plugin.manifest.name }}</strong>
              <code class="plugin-card__id">{{ plugin.manifest.id }}</code>
              <n-tag size="small" :bordered="false" :type="statusTagType(plugin.status)">
                {{ $t(`settings.plugins.status.${plugin.status}`) }}
              </n-tag>
            </div>
            <div class="plugin-card__actions">
              <n-button
                v-if="plugin.manifest.settings && plugin.manifest.settings.length > 0"
                size="small"
                @click="openSettings(plugin)"
              >
                {{ $t('settings.plugins.settings') }}
              </n-button>
              <n-button
                size="small"
                :type="plugin.status === 'running' ? 'default' : 'primary'"
                :disabled="plugin.status === 'quarantined'"
                @click="handleToggle(plugin)"
              >
                {{
                  plugin.status === 'running'
                    ? $t('settings.plugins.disable')
                    : $t('settings.plugins.enable')
                }}
              </n-button>
              <n-button size="small" tertiary type="error" @click="handleUninstall(plugin)">
                {{ $t('settings.plugins.uninstall') }}
              </n-button>
            </div>
          </div>

          <p v-if="plugin.manifest.description" class="plugin-card__desc">
            {{ plugin.manifest.description }}
          </p>
          <p v-if="plugin.status === 'quarantined'" class="plugin-card__quarantined">
            {{ $t('settings.plugins.quarantinedHint') }}
            <span v-if="plugin.crashCount > 0" class="plugin-card__watchdog">
              {{ $t('settings.plugins.crashCount', { count: plugin.crashCount }) }}
            </span>
          </p>
          <p
            v-if="plugin.status === 'quarantined' && plugin.lastError"
            class="plugin-card__watchdog"
          >
            {{ $t('settings.plugins.lastError') }}: {{ plugin.lastError }}
          </p>
          <p
            v-else-if="plugin.status === 'running' && plugin.crashCount > 0"
            class="plugin-card__watchdog"
          >
            {{ $t('settings.plugins.crashRecovered', { count: plugin.crashCount }) }}
            <template v-if="plugin.lastError">（{{ plugin.lastError }}）</template>
          </p>

          <div class="plugin-card__meta">
            <span>{{ $t('settings.plugins.version') }}: {{ plugin.manifest.version }}</span>
            <span>{{ $t('settings.plugins.author') }}: {{ plugin.manifest.author }}</span>
            <span v-if="permissionLabels(plugin).length > 0">
              {{ $t('settings.plugins.permissions') }}: {{ permissionLabels(plugin).join('、') }}
            </span>
          </div>
        </article>
      </div>
      <n-empty v-else :description="$t('settings.plugins.listEmpty')" />
    </div>

    <n-modal
      v-model:show="showSettingsModal"
      preset="card"
      style="width: 560px"
      :title="`${settingsTarget?.manifest.name ?? ''} ${$t('settings.plugins.settings')}`"
    >
      <n-form v-if="settingsTarget" label-placement="left" label-width="120">
        <n-form-item
          v-for="schema in settingsTarget.manifest.settings ?? []"
          :key="schema.key"
          :label="schema.label"
        >
          <n-input
            v-if="schema.kind === 'text'"
            v-model:value="settingsDraft[schema.key]"
            size="small"
          />
          <n-input-number
            v-else-if="schema.kind === 'number'"
            v-model:value="settingsDraft[schema.key]"
            size="small"
            :min="schema.min"
            :max="schema.max"
          />
          <n-switch
            v-else-if="schema.kind === 'boolean'"
            v-model:value="settingsDraft[schema.key]"
          />
          <n-select
            v-else-if="schema.kind === 'select'"
            v-model:value="settingsDraft[schema.key]"
            size="small"
            :options="
              (schema.options ?? []).map(option => ({ label: option.label, value: option.value }))
            "
          />
          <n-select
            v-else-if="schema.kind === 'multiSelect'"
            v-model:value="settingsDraft[schema.key]"
            size="small"
            multiple
            :options="
              (schema.options ?? []).map(option => ({ label: option.label, value: option.value }))
            "
          />
          <span v-if="schema.description" class="plugin-form__hint">{{ schema.description }}</span>
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="plugin-form__footer">
          <n-button size="small" @click="showSettingsModal = false">{{
            $t('dialog.cancel')
          }}</n-button>
          <n-button size="small" type="primary" :loading="savingSettings" @click="saveSettings">
            {{ $t('dialog.confirm') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </SettingsPageScaffold>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import SettingsPageScaffold from '../shared/SettingsPageScaffold.vue'
import type { PluginPermission } from '../../../shared/pluginManifest'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const plugins = ref<PluginInfo[]>([])
const loading = ref(false)
const showSettingsModal = ref(false)
const savingSettings = ref(false)
const settingsTarget = ref<PluginInfo | null>(null)
const settingsDraft = reactive<Record<string, unknown>>({})

const PERMISSION_LABELS: Record<PluginPermission, string> = {
  storage: 'storage',
  network: 'network',
  notifications: 'notifications',
  timers: 'timers',
  events: 'events',
  trayMenu: 'trayMenu',
  settingsUi: 'settingsUi'
}

function statusTagType(status: PluginInfo['status']): 'success' | 'default' | 'error' {
  switch (status) {
    case 'running':
      return 'success'
    case 'quarantined':
      return 'error'
    default:
      return 'default'
  }
}

function permissionLabels(plugin: PluginInfo): string[] {
  return (plugin.manifest.permissions ?? []).map(item => PERMISSION_LABELS[item])
}

async function loadPlugins() {
  loading.value = true
  try {
    const result = await window.electron.plugins.list()
    if (result.success) {
      plugins.value = result.plugins
    } else {
      message.error(result.error ?? t('settings.plugins.installFailed'))
    }
  } catch {
    message.error(t('settings.plugins.installFailed'))
  } finally {
    loading.value = false
  }
}

async function handleInstall() {
  const selected = await window.electron.plugins.selectFolder()
  if (!selected.success || !selected.folderPath) {
    return
  }
  const folderPath = selected.folderPath

  dialog.warning({
    title: t('dialog.confirm'),
    content: t('settings.plugins.installConfirm', {
      name: folderPath.split(/[/\\]/).pop() ?? folderPath
    }),
    positiveText: t('dialog.confirm'),
    negativeText: t('dialog.cancel'),
    onPositiveClick: async () => {
      const result = await window.electron.plugins.install(folderPath)
      if (result.success) {
        message.success(t('settings.plugins.installSuccess'))
        await loadPlugins()
      } else {
        message.error(result.error ?? t('settings.plugins.installFailed'))
      }
    }
  })
}

async function handleToggle(plugin: PluginInfo) {
  const running = plugin.status === 'running'
  const result = running
    ? await window.electron.plugins.disable(plugin.manifest.id)
    : await window.electron.plugins.enable(plugin.manifest.id)
  if (!result.success) {
    message.error(result.error ?? t('settings.plugins.toggleFailed'))
    return
  }
  await loadPlugins()
}

function handleUninstall(plugin: PluginInfo) {
  dialog.warning({
    title: t('dialog.confirm'),
    content: t('settings.plugins.uninstallConfirm', { name: plugin.manifest.name }),
    positiveText: t('dialog.confirm'),
    negativeText: t('dialog.cancel'),
    onPositiveClick: async () => {
      const result = await window.electron.plugins.uninstall(plugin.manifest.id)
      if (result.success) {
        await loadPlugins()
      } else {
        message.error(result.error ?? t('settings.plugins.uninstallFailed'))
      }
    }
  })
}

function openSettings(plugin: PluginInfo) {
  settingsTarget.value = plugin
  Object.keys(settingsDraft).forEach(key => delete settingsDraft[key])
  Object.assign(settingsDraft, plugin.settings)
  showSettingsModal.value = true
}

async function saveSettings() {
  if (!settingsTarget.value) return
  savingSettings.value = true
  try {
    const result = await window.electron.plugins.setSettings(settingsTarget.value.manifest.id, {
      ...settingsDraft
    })
    if (result.success) {
      message.success(t('settings.plugins.settingsSaved'))
      showSettingsModal.value = false
      await loadPlugins()
    } else {
      message.error(result.error ?? t('settings.plugins.settingsSaveFailed'))
    }
  } catch {
    message.error(t('settings.plugins.settingsSaveFailed'))
  } finally {
    savingSettings.value = false
  }
}

onMounted(() => {
  loadPlugins()
  // 看门狗状态实时刷新：插件崩溃/隔离时主进程广播，重新拉取列表
  window.electron.plugins.onStatusChanged(() => {
    loadPlugins()
  })
})
</script>

<style scoped>
.plugins {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plugins__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.plugins__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plugin-card {
  background: var(--card-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.plugin-card:hover {
  border-color: var(--primary-color);
}

.plugin-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.plugin-card__identity {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.plugin-card__identity strong {
  font-size: 15px;
  color: var(--text-1);
}

.plugin-card__id {
  font-size: 12px;
  color: var(--text-3);
  background: var(--code-color);
  padding: 2px 6px;
  border-radius: 4px;
}

.plugin-card__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.plugin-card__desc {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
  margin: 0 0 8px;
}

.plugin-card__quarantined {
  font-size: 13px;
  color: var(--error-color);
  margin: 0 0 8px;
}

.plugin-card__watchdog {
  font-size: 12px;
  color: var(--warning-color, var(--text-3));
  margin: 0 0 8px;
  line-height: 1.5;
  word-break: break-all;
}

.plugin-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--text-3);
  padding-top: 8px;
  border-top: 1px solid var(--divider-color);
}

.plugin-form__hint {
  font-size: 12px;
  color: var(--text-3);
  display: block;
  margin-top: 4px;
}

.plugin-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
