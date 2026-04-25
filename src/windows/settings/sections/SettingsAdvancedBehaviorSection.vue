<template>
  <section class="settings-section">
    <div class="settings-section__header">
      <h2>行为配置</h2>
    </div>
    <p class="settings-section__desc">配置应用启动行为、通知策略和日志级别。切换后立即生效。</p>

    <n-form label-placement="top">
      <n-form-item label="启动时自动连接">
        <n-switch
          :value="connectionBehaviorSettings.autoConnectOnAppLaunch"
          @update:value="(value: boolean) => updateConnectionBehaviorSettings({ autoConnectOnAppLaunch: value })"
        />
      </n-form-item>
      <n-form-item label="系统恢复后自动恢复连接">
        <n-switch
          :value="connectionBehaviorSettings.resumeDesiredConnectionOnWake"
          @update:value="(value: boolean) => updateConnectionBehaviorSettings({ resumeDesiredConnectionOnWake: value })"
        />
      </n-form-item>
      <n-form-item label="启用自动重试">
        <n-switch
          :value="connectionBehaviorSettings.retryEnabled"
          @update:value="(value: boolean) => updateConnectionBehaviorSettings({ retryEnabled: value })"
        />
      </n-form-item>
      <n-form-item label="重试基础延迟">
        <n-space align="center">
          <n-input-number
            :value="connectionBehaviorSettings.retryBaseDelayMs"
            :min="250"
            :max="300000"
            :step="250"
            :precision="0"
            @update:value="(value: number | null) => updateConnectionBehaviorSettings({ retryBaseDelayMs: value ?? 1000 })"
          />
          <span>毫秒</span>
        </n-space>
      </n-form-item>
      <n-form-item label="重试最大延迟">
        <n-space align="center">
          <n-input-number
            :value="connectionBehaviorSettings.retryMaxDelayMs"
            :min="250"
            :max="300000"
            :step="250"
            :precision="0"
            @update:value="(value: number | null) => updateConnectionBehaviorSettings({ retryMaxDelayMs: value ?? 30000 })"
          />
          <span>毫秒</span>
        </n-space>
      </n-form-item>
      <n-form-item label="最大重试次数">
        <n-space align="center">
          <n-input-number
            :value="connectionBehaviorSettings.retryMaxAttempts"
            :min="1"
            :max="1000"
            :precision="0"
            clearable
            placeholder="留空表示不限次数"
            @update:value="(value: number | null) => updateConnectionBehaviorSettings({ retryMaxAttempts: value })"
          />
          <span>次</span>
        </n-space>
      </n-form-item>
      <n-form-item label="握手超时">
        <n-space align="center">
          <n-input-number
            :value="connectionBehaviorSettings.handshakeTimeoutMs"
            :min="1000"
            :max="60000"
            :step="500"
            :precision="0"
            @update:value="(value: number | null) => updateConnectionBehaviorSettings({ handshakeTimeoutMs: value ?? 8000 })"
          />
          <span>毫秒</span>
        </n-space>
      </n-form-item>
      <n-form-item label="启动时自动加载上次模型">
        <n-switch v-model:value="advancedSettings.autoLoadLastModel" @update:value="applyAdvancedSettingChange" />
      </n-form-item>
      <n-form-item label="录音时启用静音检测">
        <n-switch v-model:value="advancedSettings.silenceDetectionEnabled" @update:value="applyAdvancedSettingChange" />
        <template #feedback>
          长时间未检测到声音时自动结束录音，减少空白语音片段。
        </template>
      </n-form-item>
      <n-form-item label="基础事件弹窗提示">
        <n-switch v-model:value="advancedSettings.showBaseEventNotifications" @update:value="applyAdvancedSettingChange" />
      </n-form-item>
      <n-form-item label="日志级别">
        <n-radio-group v-model:value="advancedSettings.logLevel" @update:value="applyAdvancedSettingChange">
          <n-space>
            <n-radio-button value="info">Info</n-radio-button>
            <n-radio-button value="debug">Debug</n-radio-button>
          </n-space>
        </n-radio-group>
      </n-form-item>
      <n-form-item label="最大气泡数量">
        <n-space align="center">
          <n-input-number v-model:value="advancedSettings.bubbleStackMax" :min="1" :max="10" :precision="0" @update:value="applyAdvancedSettingChange" />
          <span>条</span>
        </n-space>
      </n-form-item>
      <n-form-item label="气泡追加时间窗口">
        <n-space align="center">
          <n-input-number v-model:value="advancedSettings.bubbleFollowUpWindowMs" :min="500" :max="15000" :step="500" :precision="0" @update:value="applyAdvancedSettingChange" />
          <span>毫秒</span>
        </n-space>
      </n-form-item>
      <n-form-item label="图片内联阈值">
        <n-space align="center">
          <n-input-number v-model:value="advancedSettings.imageInlineThresholdKb" :min="64" :max="2048" :step="64" :precision="0" @update:value="applyAdvancedSettingChange" />
          <span>KB</span>
        </n-space>
      </n-form-item>
      <n-form-item label="图片大小上限">
        <n-space align="center">
          <n-input-number v-model:value="advancedSettings.imageMaxSizeMb" :min="1" :max="50" :step="1" :precision="0" @update:value="applyAdvancedSettingChange" />
          <span>MB</span>
        </n-space>
      </n-form-item>
      <n-form-item label="截图默认目标">
        <n-radio-group :value="screenshotSettings.defaultTarget" @update:value="(value: 'active' | 'desktop') => updateScreenshotSettings({ defaultTarget: value })">
          <n-space>
            <n-radio-button value="active">当前窗口</n-radio-button>
            <n-radio-button value="desktop">整个桌面</n-radio-button>
          </n-space>
        </n-radio-group>
      </n-form-item>
      <n-form-item label="截图质量">
        <n-space align="center">
          <n-input-number :value="screenshotSettings.quality" :min="30" :max="100" :step="5" :precision="0" @update:value="(value: number | null) => updateScreenshotSettings({ quality: value ?? 80 })" />
          <span>%</span>
        </n-space>
      </n-form-item>
      <n-form-item label="截图最大宽度">
        <n-space align="center">
          <n-input-number :value="screenshotSettings.maxWidth" :min="640" :max="3840" :step="160" :precision="0" @update:value="(value: number | null) => updateScreenshotSettings({ maxWidth: value ?? 1920 })" />
          <span>像素</span>
        </n-space>
      </n-form-item>
    </n-form>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>桌面交互</h2>
    </div>
    <p class="settings-section__desc">控制桌面窗口的置顶、鼠标穿透和全屏应用检测行为。此处开关会在切换后立即保存并生效。</p>

    <n-form label-placement="top">
      <n-form-item label="始终置顶显示">
        <n-switch :value="desktopFeatureSettings.alwaysOnTop" @update:value="(value: boolean) => updateDesktopFeatureSetting('alwaysOnTop', value)" />
        <template #feedback>
          保持桌面角色窗口位于普通应用之上，适合需要持续显示角色的场景。
        </template>
      </n-form-item>
      <n-form-item label="始终穿透">
        <n-switch :value="desktopFeatureSettings.fullPassThrough" @update:value="(value: boolean) => updateDesktopFeatureSetting('fullPassThrough', value)" />
        <template #feedback>
          开启后主窗口将持续忽略鼠标事件；该模式优先级高于智能穿透。
        </template>
      </n-form-item>
      <n-form-item label="智能穿透">
        <n-switch
          :value="desktopFeatureSettings.dynamicPassThrough"
          :disabled="!platformCapabilities?.mousePassthroughForward || desktopFeatureSettings.fullPassThrough"
          @update:value="(value: boolean) => updateDesktopFeatureSetting('dynamicPassThrough', value)"
        />
        <template #feedback>
          仅在鼠标悬停模型或交互控件时可点击，其他区域自动穿透到底层应用。
        </template>
      </n-form-item>
      <n-form-item label="自动检测全屏应用">
        <n-switch
          :value="desktopFeatureSettings.autoDetectFullscreen"
          :disabled="!platformCapabilities?.gameMode.supported"
          @update:value="(value: boolean) => updateDesktopFeatureSetting('autoDetectFullscreen', value)"
        />
        <template #feedback>
          检测到游戏或其他全屏应用时，自动配合桌面模式调整窗口行为；当前平台不支持时会禁用此选项。
        </template>
      </n-form-item>
    </n-form>
  </section>

  <section class="settings-section">
    <div class="settings-section__header">
      <h2>平台能力</h2>
    </div>
    <p class="settings-section__desc">当前系统平台支持的功能特性。</p>

    <div class="settings-kv-list">
      <div class="settings-kv-list__row">
        <span>当前平台</span>
        <strong>{{ platformDisplayName }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>自动检测全屏应用</span>
        <strong>{{ gameModeCapabilityLabel }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>智能穿透支持</span>
        <strong>{{ passThroughCapabilityLabel }}</strong>
      </div>
      <div class="settings-kv-list__row">
        <span>置顶层级策略</span>
        <strong>{{ alwaysOnTopLevelLabel }}</strong>
      </div>
    </div>

    <n-alert v-if="platformCompatibilityNotice" :type="platformCompatibilityNotice.type" :show-icon="false">
      {{ platformCompatibilityNotice.text }}
    </n-alert>
  </section>
</template>

<script setup lang="ts">
import { useAdvancedSettingsDomain } from '../domains/createAdvancedSettingsDomain'

const {
  advancedSettings,
  alwaysOnTopLevelLabel,
  applyAdvancedSettingChange,
  connectionBehaviorSettings,
  desktopFeatureSettings,
  gameModeCapabilityLabel,
  passThroughCapabilityLabel,
  platformCapabilities,
  platformCompatibilityNotice,
  platformDisplayName,
  screenshotSettings,
  updateConnectionBehaviorSettings,
  updateDesktopFeatureSetting,
  updateScreenshotSettings,
} = useAdvancedSettingsDomain()
</script>
