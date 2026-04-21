<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>工作区状态</h2>
    </div>
    <p class="settings-section__desc">当前连接和会话的运行状态信息。</p>

    <div class="settings-kv-list">
      <div v-for="row in workspaceRows" :key="row.label" class="settings-kv-list__row">
        <span>{{ row.label }}</span>
        <strong>{{ row.value }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>当前模型</span>
        <strong>{{ currentModelDisplay }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>主题色</span>
        <strong>{{ sourceColor.toUpperCase() }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useConnectionSettingsDomain } from '../domains/createConnectionSettingsDomain'
import { useModelSettingsDomain } from '../domains/createModelSettingsDomain'

const { workspaceRows } = useConnectionSettingsDomain()
const { currentModelDisplay, sourceColor } = useModelSettingsDomain()
</script>
