<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>关于</h2>
    </div>

    <div class="settings-kv-list">
      <div class="settings-kv-list__row">
        <span>应用名称</span>
        <strong>{{ APP_METADATA.displayName }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>版本</span>
        <strong>v{{ appVersion }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>更新状态</span>
        <strong>{{ updateStatusLabel }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>自动检查更新</span>
        <strong>{{ updaterSettings.autoUpdateEnabled ? '已启用' : '已关闭' }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>作者</span>
        <strong>{{ APP_METADATA.authorName }}</strong>
      </div>
    </div>

    <n-form label-placement="top" style="margin-top: 16px;">
      <n-form-item label="启动后自动检查更新">
        <n-switch :value="updaterSettings.autoUpdateEnabled" @update:value="updateAutoUpdateSetting" />
        <template #feedback>
          关闭后不会在启动时自动检查更新，但手动“检查更新”仍可继续使用。
        </template>
      </n-form-item>
    </n-form>

    <div class="settings-section__actions">
      <n-button :loading="checkingUpdate" @click="handleCheckUpdates">检查更新</n-button>
      <n-button v-if="canInstallUpdate" type="primary" @click="handleInstallUpdate">重启并安装</n-button>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>相关项目</h2>
    </div>

    <div class="link-stack">
      <button class="ghost-button" type="button" @click="handleOpenLink(APP_LINKS.astrbot)">
        AstrBot
      </button>
      <button class="ghost-button" type="button" @click="handleOpenLink(APP_LINKS.repository)">
        本项目仓库
      </button>
      <button class="ghost-button" type="button" @click="handleOpenLink(APP_LINKS.adapterPlugin)">
        平台适配器插件
      </button>
    </div>
  </section>

  <section class="settings-section">
    <p class="settings-section__note">Powered by Live2D</p>
  </section>
</template>

<script setup lang="ts">
import { APP_LINKS, APP_METADATA } from '@/shared/metadata'
import { useAboutSettingsDomain } from '../domains/createAboutSettingsDomain'

const {
  appVersion,
  canInstallUpdate,
  checkingUpdate,
  handleCheckUpdates,
  handleInstallUpdate,
  handleOpenLink,
  updateAutoUpdateSetting,
  updateStatusLabel,
  updaterSettings,
} = useAboutSettingsDomain()
</script>

<style scoped>
.link-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ghost-button {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--desktop-radius-control);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--desktop-panel-border);
  color: var(--color-text-primary);
  font-size: 13px;
  transition: all var(--duration-fast) var(--ease-out);
}

.ghost-button:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--desktop-panel-border-strong);
}
</style>
