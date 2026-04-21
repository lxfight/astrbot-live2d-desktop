<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>窗口监听</h2>
      <span class="status-pill" :class="dirty ? 'status-pill--warning' : 'status-pill--success'">
        {{ dirty ? '未保存' : '已同步' }}
      </span>
    </div>
    <p class="settings-section__desc">改为草稿态编辑。所有修改只在点击“保存更改”后写入后端，避免输入过程持续触发 IPC。</p>
    <div class="settings-section__actions">
      <n-button :disabled="!dirty || saving" @click="resetDraft">放弃修改</n-button>
      <n-button type="primary" :loading="saving" :disabled="!canSave" @click="saveDraft">保存更改</n-button>
      <n-button tertiary type="error" :loading="saving" @click="resetPersisted">恢复默认</n-button>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>基础开关</h2>
    </div>
    <p class="settings-section__desc">监听窗口变化，让 AI 主动感知你的操作。这里的改动在保存前只会停留在本地草稿。</p>

    <n-form label-placement="top">
      <n-form-item label="启用窗口监听">
        <n-switch v-model:value="draftConfig.enabled" />
      </n-form-item>
      <n-form-item label="启用应用启动监听">
        <n-switch v-model:value="draftConfig.appLaunchEnabled" />
        <template #feedback>
          关闭后不会再因检测到新应用启动而主动发送桌面事件，但窗口监听的其他配置仍可保留。
        </template>
      </n-form-item>
    </n-form>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>监控频率</h2>
    </div>
    <p class="settings-section__desc">调整事件触发的频率限制，避免 AI 频繁响应。</p>

    <n-form label-placement="top">
      <n-form-item label="全局频率限制（毫秒）">
        <n-input-number v-model:value="draftConfig.throttle.globalInterval" :min="0" :max="60000" :step="100" placeholder="默认 1000ms" />
        <template #feedback>两次事件之间的最小间隔。默认 1000ms（1秒）。</template>
      </n-form-item>
      <n-form-item label="单窗口频率限制（毫秒）">
        <n-input-number v-model:value="draftConfig.throttle.perWindowInterval" :min="0" :max="60000" :step="100" placeholder="默认 3000ms" />
        <template #feedback>同一窗口两次事件之间的最小间隔。默认 3000ms（3秒）。</template>
      </n-form-item>
      <n-form-item label="最小间隔（毫秒）">
        <n-input-number v-model:value="draftConfig.throttle.minInterval" :min="0" :max="1000" :step="10" placeholder="默认 100ms" />
        <template #feedback>防止过于频繁的触发。默认 100ms。</template>
      </n-form-item>
    </n-form>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>监控事件</h2>
    </div>
    <p class="settings-section__desc">选择需要监控的窗口变化类型。</p>

    <n-form label-placement="left">
      <n-form-item label="窗口获得焦点（应用打开/切换）">
        <n-switch v-model:value="draftConfig.events.focus" />
      </n-form-item>
      <n-form-item label="窗口失去焦点">
        <n-switch v-model:value="draftConfig.events.blur" />
      </n-form-item>
      <n-form-item label="新窗口创建">
        <n-switch v-model:value="draftConfig.events.create" />
      </n-form-item>
      <n-form-item label="窗口关闭">
        <n-switch v-model:value="draftConfig.events.destroy" />
      </n-form-item>
      <n-form-item label="窗口进入全屏">
        <n-switch v-model:value="draftConfig.events.fullscreen" />
      </n-form-item>
      <n-form-item label="窗口退出全屏">
        <n-switch v-model:value="draftConfig.events.windowed" />
      </n-form-item>
      <n-form-item label="窗口大小变化">
        <n-switch v-model:value="draftConfig.events.resize" />
      </n-form-item>
      <n-form-item label="窗口位置变化">
        <n-switch v-model:value="draftConfig.events.move" />
      </n-form-item>
      <n-form-item label="窗口最小化">
        <n-switch v-model:value="draftConfig.events.minimize" />
      </n-form-item>
      <n-form-item label="窗口最大化">
        <n-switch v-model:value="draftConfig.events.maximize" />
      </n-form-item>
      <n-form-item label="窗口恢复">
        <n-switch v-model:value="draftConfig.events.restore" />
      </n-form-item>
    </n-form>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>AI 响应模式</h2>
    </div>
    <p class="settings-section__desc">选择 AI 响应窗口事件的方式。</p>

    <n-radio-group v-model:value="draftConfig.aiResponse.mode">
      <n-space direction="vertical">
        <n-radio value="first-open">仅首次打开应用时响应</n-radio>
        <n-radio value="every-switch">每次应用切换都响应</n-radio>
        <n-radio value="specific-apps">仅检测到特定应用时响应</n-radio>
      </n-space>
    </n-radio-group>

    <div v-if="draftConfig.aiResponse.mode === 'specific-apps'" class="specific-apps-config">
      <n-form-item label="特定应用列表（每行一个进程名）">
        <n-input
          v-model:value="specificAppsInput"
          type="textarea"
          :rows="4"
          placeholder="chrome.exe&#10;firefox.exe&#10;code.exe"
          @update:value="updateSpecificApps"
        />
      </n-form-item>
    </div>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>忽略规则</h2>
    </div>
    <p class="settings-section__desc">配置额外需要忽略的进程和窗口。系统关键进程已内置过滤，此处添加的规则会与内置规则合并生效。</p>

    <n-alert type="info" :show-icon="false" style="margin-bottom: 16px;">
      <strong>内置忽略规则（始终生效）</strong>
      <div style="margin-top: 8px; font-size: 12px;">
        进程：dwm.exe, csrss.exe, explorer.exe, SearchUI.exe 等系统进程<br>
        标题：Program Manager, 锁屏, Lock Screen, Task Switching 等系统窗口
      </div>
    </n-alert>

    <n-form label-placement="top">
      <n-form-item label="额外忽略的进程名（每行一个）">
        <n-input
          v-model:value="ignoreProcessNamesInput"
          type="textarea"
          :rows="3"
          placeholder="输入额外要忽略的进程名..."
          @update:value="updateIgnoreProcessNames"
        />
        <template #feedback>这些进程名会与内置规则合并，用于过滤不需要触发 AI 响应的进程。</template>
      </n-form-item>
      <n-form-item label="额外忽略的窗口标题关键词（每行一个）">
        <n-input
          v-model:value="ignoreTitleKeywordsInput"
          type="textarea"
          :rows="3"
          placeholder="输入额外要忽略的标题关键词..."
          @update:value="updateIgnoreTitleKeywords"
        />
        <template #feedback>标题包含这些关键词的窗口会被忽略。</template>
      </n-form-item>
    </n-form>
  </section>
</template>

<script setup lang="ts">
import { useWatcherSettingsDomain } from '../domains/createWatcherSettingsDomain'

const {
  canSave,
  dirty,
  draftConfig,
  ignoreProcessNamesInput,
  ignoreTitleKeywordsInput,
  resetDraft,
  resetPersisted,
  saveDraft,
  saving,
  specificAppsInput,
  updateIgnoreProcessNames,
  updateIgnoreTitleKeywords,
  updateSpecificApps,
} = useWatcherSettingsDomain()
</script>

<style scoped>
.specific-apps-config {
  margin-top: 16px;
}
</style>
