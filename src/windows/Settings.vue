<template>
  <div class="settings-page">
    <header class="settings-page__header">
      <div class="settings-page__title">
        <span class="settings-page__eyebrow">AstrBot Live2D Desktop</span>
        <h1>设置</h1>
        <p>连接、模型、桌面行为与更新管理。</p>
      </div>

      <div class="settings-page__meta">
        <span class="status-pill" :class="isConnected ? 'status-pill--success' : 'status-pill--warning'">
          {{ isConnected ? '已连接' : '未连接' }}
        </span>
        <span class="settings-meta-chip">
          <strong>模型</strong>
          <span>{{ currentModelDisplay }}</span>
        </span>
        <span class="settings-meta-chip">
          <span class="settings-theme-swatch" :style="themeSwatchStyle"></span>
          <span>{{ sourceColor.toUpperCase() }}</span>
        </span>
        <span class="settings-meta-chip">{{ platformDisplayName }}</span>
      </div>
    </header>

    <nav class="settings-nav">
      <button
        v-for="item in menuItems"
        :key="item.key"
        class="settings-nav__item"
        :class="{ 'settings-nav__item--active': activeMenu === item.key }"
        type="button"
        @click="activeMenu = item.key"
      >
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="section-stack settings-page__content">
      <template v-if="activeMenu === 'connection'">
        <div class="section-heading">
          <h2>连接工作区</h2>
          <p>这里只保留连接和资源服务配置，不再用概览卡片占掉首屏空间。</p>
        </div>

        <div class="section-grid settings-grid">
          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <div>
                <h3>Bridge 连接</h3>
                <p>连接 AstrBot Live2D 适配器所需的基础参数。</p>
              </div>
              <span class="status-pill" :class="isConnected ? 'status-pill--success' : 'status-pill--warning'">
                {{ isConnected ? '已连接' : '未连接' }}
              </span>
            </div>

            <n-form label-placement="top">
              <n-form-item label="服务器地址">
                <n-input
                  v-model:value="serverUrl"
                  placeholder="ws://127.0.0.1:9090/astrbot/live2d"
                />
              </n-form-item>
              <n-form-item label="认证令牌">
                <n-input
                  v-model:value="token"
                  type="password"
                  show-password-on="click"
                  placeholder="必填，需与 AstrBot 适配器 auth_token 一致"
                />
              </n-form-item>
            </n-form>

            <div class="settings-card__actions">
              <n-button type="primary" @click="handleConnect" :disabled="isConnected || !token.trim()">
                {{ isConnected ? '已连接' : '连接服务器' }}
              </n-button>
              <n-button @click="handleDisconnect" :disabled="!isConnected">
                断开连接
              </n-button>
            </div>
          </section>

          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <div>
                <h3>连接状态</h3>
                <p>会话信息和资源服务地址都放在同一处查看。</p>
              </div>
            </div>

            <div class="settings-summary-list">
              <div class="settings-summary-row">
                <span>状态</span>
                <strong>{{ isConnected ? '在线' : '离线' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>用户 ID</span>
                <strong>{{ connectionStore.userId || '尚未分配' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>会话 ID</span>
                <strong>{{ connectionStore.sessionId || '尚未建立' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>资源地址</span>
                <strong>{{ connectionStore.resourceBaseUrl || '自动跟随连接地址' }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>资源路径</span>
                <strong>{{ connectionStore.resourcePath || '/resources' }}</strong>
              </div>
            </div>
          </section>
        </div>

        <section class="panel-card settings-card">
          <div class="settings-card__header">
            <div>
              <h3>资源服务高级配置</h3>
              <p>只有老版本适配器或特殊网络映射场景，才需要覆盖默认的资源服务地址与路径。</p>
            </div>
          </div>

          <n-alert type="info" :show-icon="false">
            默认情况下，图片、音频、视频和文件资源会自动复用与 WebSocket 相同的服务地址、端口和认证令牌。
          </n-alert>

          <n-form label-placement="top" class="settings-form-grid">
            <n-form-item label="资源服务地址">
              <n-input
                v-model:value="resourceServerUrl"
                placeholder="留空时自动跟随连接地址"
              />
            </n-form-item>
            <n-form-item label="资源路径">
              <n-input
                v-model:value="resourceServerPath"
                placeholder="默认沿用握手路径或 /resources"
              />
            </n-form-item>
            <n-form-item label="资源访问令牌">
              <n-input
                v-model:value="resourceAccessToken"
                type="password"
                show-password-on="click"
                placeholder="留空时复用 WebSocket 认证令牌"
              />
            </n-form-item>
          </n-form>
        </section>
      </template>

      <template v-else-if="activeMenu === 'model'">
        <div class="section-heading">
          <h2>模型管理</h2>
          <p>导入、切换和清理本地模型，界面主题会跟随当前模型主色更新。</p>
        </div>

        <section class="panel-card settings-card">
          <div class="settings-card__header">
            <div>
              <h3>模型库</h3>
              <p>当前共 {{ modelList.length }} 个模型。</p>
            </div>
            <n-button type="primary" @click="handleImportModel">导入模型</n-button>
          </div>

          <div v-if="modelList.length > 0" class="model-grid">
            <article
              v-for="model in modelList"
              :key="model.name"
              class="model-card"
              :class="{ 'model-card--active': currentModelPath === model.path }"
            >
              <div class="model-card__preview" :style="themeSwatchStyle">
                <span>{{ model.name.slice(0, 1).toUpperCase() }}</span>
              </div>
              <div class="model-card__body">
                <strong>{{ model.name }}</strong>
                <p>{{ model.path }}</p>
              </div>
              <div class="model-card__actions">
                <n-button size="small" type="primary" @click="handleLoadModel(model.path)">加载</n-button>
                <n-button size="small" tertiary type="error" @click="handleDeleteModel(model.name)">删除</n-button>
              </div>
            </article>
          </div>
          <n-empty v-else description="暂无模型" />
        </section>
      </template>

      <template v-else-if="activeMenu === 'advanced'">
        <div class="section-heading">
          <h2>高级选项</h2>
          <p>桌面行为、全局快捷键和平台能力集中在这里。</p>
        </div>

        <div class="section-grid settings-grid">
          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <div>
                <h3>行为配置</h3>
                <p>这些配置会直接影响启动、录音和通知行为。</p>
              </div>
            </div>

            <n-form label-placement="top">
              <n-form-item label="启动时自动连接">
                <n-switch v-model:value="advancedSettings.autoConnect" />
              </n-form-item>
              <n-form-item label="基础事件弹窗提示">
                <n-switch v-model:value="advancedSettings.showBaseEventNotifications" />
              </n-form-item>
              <n-form-item label="日志级别">
                <n-radio-group v-model:value="advancedSettings.logLevel">
                  <n-space>
                    <n-radio-button value="info">Info（默认）</n-radio-button>
                    <n-radio-button value="debug">Debug（调试）</n-radio-button>
                  </n-space>
                </n-radio-group>
              </n-form-item>
              <n-form-item label="全局录音快捷键">
                <div class="shortcut-row">
                  <n-input
                    v-model:value="advancedSettings.recordingShortcut"
                    placeholder="按下快捷键..."
                    readonly
                    @keydown="handleShortcutKeyDown"
                  />
                  <n-button @click="handleClearShortcut">清除</n-button>
                  <n-button type="primary" @click="handleRegisterShortcut">
                    {{ shortcutRegistered ? '已注册' : '注册' }}
                  </n-button>
                </div>
              </n-form-item>
              <n-form-item label="最长录音时长">
                <n-space align="center">
                  <n-input-number
                    v-model:value="recordingSecondsValue"
                    :min="1"
                    :max="60"
                    :precision="0"
                  />
                  <span>秒（上限 60 秒）</span>
                </n-space>
              </n-form-item>
            </n-form>

            <n-alert type="warning" :show-icon="false">
              全局快捷键用于手动录音；语音唤醒功能已暂时移除。关闭基础事件提示后，不再显示连接成功等常规提示，但错误提示仍会保留。
            </n-alert>

            <div class="settings-card__actions">
              <n-button type="primary" @click="saveAdvancedSettings">保存设置</n-button>
            </div>
          </section>

          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <div>
                <h3>平台能力</h3>
                <p>这些能力决定了穿透、全屏检测和置顶层级的实际表现。</p>
              </div>
            </div>

            <div class="settings-summary-list">
              <div class="settings-summary-row">
                <span>当前平台</span>
                <strong>{{ platformDisplayName }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>自动检测全屏应用</span>
                <strong>{{ gameModeCapabilityLabel }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>动态穿透</span>
                <strong>{{ passThroughCapabilityLabel }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>置顶层级策略</span>
                <strong>{{ alwaysOnTopLevelLabel }}</strong>
              </div>
            </div>

            <n-alert v-if="platformCompatibilityNotice" :type="platformCompatibilityNotice.type" :show-icon="false">
              {{ platformCompatibilityNotice.text }}
            </n-alert>
          </section>
        </div>

        <section class="panel-card settings-card">
          <div class="settings-card__header">
            <div>
              <h3>数据管理</h3>
              <p>这些操作不可逆，单独放置以降低误触风险。</p>
            </div>
          </div>

          <div class="settings-card__actions">
            <n-button @click="handleOpenLogs">打开日志目录</n-button>
            <n-button @click="handleClearCache">清除缓存</n-button>
            <n-button type="error" @click="handleResetSettings">重置所有设置</n-button>
          </div>
        </section>
      </template>

      <template v-else>
        <div class="section-heading">
          <h2>关于</h2>
          <p>版本、更新和相关项目入口。</p>
        </div>

        <div class="section-grid settings-grid">
          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <div>
                <h3>AstrBot Live2D Desktop</h3>
                <p>一个用于 AstrBot 的 Live2D 桌面客户端，支持模型展示、交互和语音对话。</p>
              </div>
            </div>

            <div class="settings-summary-list">
              <div class="settings-summary-row">
                <span>版本</span>
                <strong>v{{ appVersion }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>更新状态</span>
                <strong>{{ updateStatusLabel }}</strong>
              </div>
              <div class="settings-summary-row">
                <span>作者</span>
                <strong>lxfight</strong>
              </div>
            </div>

            <div class="settings-card__actions">
              <n-button :loading="checkingUpdate" @click="handleCheckUpdates">检查更新</n-button>
              <n-button v-if="canInstallUpdate" type="primary" @click="handleInstallUpdate">重启并安装</n-button>
            </div>
          </section>

          <section class="panel-card settings-card">
            <div class="settings-card__header">
              <div>
                <h3>相关项目</h3>
                <p>这些链接会调用系统浏览器打开。</p>
              </div>
            </div>

            <div class="link-stack">
              <button class="ghost-button" type="button" @click="handleOpenLink('https://github.com/AstrBotDevs/AstrBot')">
                AstrBot
              </button>
              <button class="ghost-button" type="button" @click="handleOpenLink('https://github.com/lxfight/astrbot-live2d-desktop')">
                本项目仓库
              </button>
              <button class="ghost-button" type="button" @click="handleOpenLink('https://github.com/lxfight/astrbot_plugin_live2d_adapter')">
                平台适配器插件
              </button>
            </div>
          </section>
        </div>

        <section class="panel-card settings-card">
          <div class="settings-card__header">
            <div>
              <h3>版权声明</h3>
              <p>本软件使用 Live2D Cubism SDK。Live2D 是 Live2D Inc. 的注册商标。</p>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDialog, useMessage } from 'naive-ui'
import { Drama, Globe, Info, Settings } from 'lucide-vue-next'
import { useConnectionStore } from '@/stores/connection'
import { useThemeStore } from '@/stores/theme'
import {
  DEFAULT_ADVANCED_SETTINGS,
  clampMaxRecordingSeconds,
  loadAdvancedSettings,
  normalizeAdvancedSettings,
  saveAdvancedSettings as persistAdvancedSettings,
} from '@/utils/advancedSettings'

const message = useMessage()
const dialog = useDialog()
const connectionStore = useConnectionStore()
const themeStore = useThemeStore()
const { currentModelPath, resolvedModelName, palette, sourceColor } = storeToRefs(themeStore)
const { isConnected } = storeToRefs(connectionStore)

const activeMenu = ref('connection')
const serverUrl = ref(connectionStore.serverUrl)
const token = ref(connectionStore.token)
const resourceServerUrl = ref(connectionStore.customResourceBaseUrl)
const resourceServerPath = ref(connectionStore.customResourcePath)
const resourceAccessToken = ref(connectionStore.customResourceToken)
const modelList = ref<Array<{ name: string; path: string }>>([])
const appVersion = ref('')
const platformCapabilities = ref<PlatformCapabilities | null>(null)
const updateState = ref<UpdateState | null>(null)
const checkingUpdate = ref(false)
const advancedSettings = ref({
  ...DEFAULT_ADVANCED_SETTINGS,
})
const shortcutRegistered = ref(false)

const menuItems = [
  { key: 'connection', icon: Globe, label: '连接' },
  { key: 'model', icon: Drama, label: '模型' },
  { key: 'advanced', icon: Settings, label: '高级' },
  { key: 'about', icon: Info, label: '关于' },
]

const recordingSecondsValue = computed({
  get: () => advancedSettings.value.maxRecordingSeconds,
  set: (value: number | null) => {
    advancedSettings.value.maxRecordingSeconds = clampMaxRecordingSeconds(
      value ?? DEFAULT_ADVANCED_SETTINGS.maxRecordingSeconds,
    )
  },
})

const themeSwatchStyle = computed(() => ({
  background: `linear-gradient(135deg, ${palette.value.accent}, ${palette.value.chartPalette[1]})`,
  boxShadow: `0 12px 24px ${palette.value.shadowColor}`,
}))

const currentModelDisplay = computed(() => resolvedModelName.value || '尚未加载模型')

const platformDisplayName = computed(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return '未知'

  if (capabilities.platform === 'win32') return 'Windows'
  if (capabilities.platform === 'darwin') return 'macOS'
  if (capabilities.platform === 'linux') {
    return capabilities.linuxSessionType === 'n/a'
      ? 'Linux'
      : `Linux (${capabilities.linuxSessionType})`
  }

  return capabilities.platform
})

const gameModeCapabilityLabel = computed(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return '未知'
  if (!capabilities.gameMode.supported) {
    return `不可用（${capabilities.gameMode.reason || '当前平台暂不支持'}）`
  }

  return capabilities.gameMode.mode === 'native-window-manager'
    ? '可用（原生窗口管理器）'
    : '可用（活跃窗口启发式）'
})

const passThroughCapabilityLabel = computed(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return '未知'
  return capabilities.mousePassthroughForward
    ? '支持完整动态穿透'
    : '仅基础穿透，不启用动态转发'
})

const alwaysOnTopLevelLabel = computed(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return '未知'
  return capabilities.alwaysOnTopLevel === 'screen-saver' ? 'screen-saver' : 'default'
})

const platformCompatibilityNotice = computed<null | { type: 'info' | 'warning'; text: string }>(() => {
  const capabilities = platformCapabilities.value
  if (!capabilities) return null

  if (capabilities.platform === 'linux') {
    if (capabilities.linuxSessionType === 'wayland') {
      return {
        type: 'warning',
        text: 'Wayland 会话下将关闭动态穿透，并禁用自动检测全屏应用；建议在支持 X11 的环境中使用以获得更完整体验。',
      }
    }

    return {
      type: 'info',
      text: 'Linux 会话下动态穿透会降级为基础穿透，自动更新需通过 Releases 手动下载。',
    }
  }

  if (capabilities.platform === 'win32' && !capabilities.gameMode.supported) {
    return {
      type: 'info',
      text: `当前 Windows 平台已关闭自动检测全屏应用：${capabilities.gameMode.reason || '能力不可用'}`,
    }
  }

  return null
})

const updateStatusLabel = computed(() => {
  if (!updateState.value) {
    return '更新状态未知'
  }

  if (updateState.value.status === 'downloading' && typeof updateState.value.progress === 'number') {
    return `${updateState.value.message}（${Math.round(updateState.value.progress)}%）`
  }

  return updateState.value.message
})

const canInstallUpdate = computed(() => updateState.value?.status === 'downloaded')

watch([serverUrl, token], ([nextUrl, nextToken]) => {
  connectionStore.setConnectionConfig(nextUrl, nextToken)
})

watch([resourceServerUrl, resourceServerPath, resourceAccessToken], ([nextUrl, nextPath, nextToken]) => {
  connectionStore.setResourceConfig(nextUrl, nextPath, nextToken)
})

onMounted(async () => {
  await loadModelList()
  loadSettings()
  themeStore.syncFromStorage()

  try {
    platformCapabilities.value = await window.electron.window.getPlatformCapabilities()
  } catch {
    platformCapabilities.value = null
  }

  appVersion.value = await window.electron.window.getAppVersion()

  try {
    updateState.value = await window.electron.update.getState()
  } catch {
    updateState.value = null
  }

  window.electron.update.onStateChanged((state: UpdateState) => {
    updateState.value = state
  })

  await checkShortcutRegistration()

  window.electron.bridge.onConnected((payload: any) => {
    connectionStore.isConnected = true
    connectionStore.applySessionState(payload)
  })

  window.electron.bridge.onDisconnected(() => {
    connectionStore.resetSessionState()
  })

  await connectionStore.checkConnection()
})

async function checkShortcutRegistration() {
  if (!advancedSettings.value.recordingShortcut) {
    shortcutRegistered.value = false
    return
  }

  const electronFormat = convertToElectronFormat(advancedSettings.value.recordingShortcut)
  shortcutRegistered.value = await window.electron.shortcut.isRegistered(electronFormat)
}

async function applyLogLevelSetting(level: 'info' | 'debug') {
  try {
    await window.electron.log.setLevel(level)
  } catch (error) {
    console.warn('[设置] 应用日志级别失败:', error)
  }
}

function loadSettings() {
  advancedSettings.value = loadAdvancedSettings()
  void applyLogLevelSetting(advancedSettings.value.logLevel)
}

async function loadModelList() {
  const result = await window.electron.model.getList()
  if (result.success && result.models) {
    modelList.value = result.models
  }
}

async function handleConnect() {
  const targetUrl = serverUrl.value.trim()
  const authToken = token.value.trim()

  if (!authToken) {
    message.error('请先填写认证密钥')
    return
  }

  if (authToken.length < 16) {
    message.error('认证密钥长度至少 16 位')
    return
  }

  token.value = authToken
  const result = await connectionStore.connect(targetUrl, authToken)
  if (result.success) {
    message.success('连接成功')
  } else {
    message.error(`连接失败: ${result.error}`)
  }
}

async function handleDisconnect() {
  const result = await connectionStore.disconnect()
  if (result.success) {
    message.success('已断开连接')
  } else {
    message.error(`断开失败: ${result.error}`)
  }
}

async function handleImportModel() {
  const result = await window.electron.model.selectFolder()

  if (result.canceled) return

  if (!result.success) {
    message.error(`选择文件夹失败: ${result.error}`)
    return
  }

  const folderName = result.folderPath!.split(/[/\\]/).pop() || 'model'
  const importResult = await window.electron.model.import(result.folderPath!, folderName)

  if (!importResult.success) {
    message.error(`导入模型失败: ${importResult.error}`)
    return
  }

  if (importResult.modelFiles && importResult.modelFiles.length > 1 && importResult.chosenFile) {
    message.info(`检测到多个模型文件，已自动选择：${importResult.chosenFile}`)
  }

  message.success('模型导入成功')
  await loadModelList()
}

async function handleLoadModel(modelPath: string) {
  await window.electron.model.load(modelPath)
  message.success('模型加载指令已发送')
}

async function handleDeleteModel(modelName: string) {
  const result = await window.electron.model.delete(modelName)
  if (result.success) {
    message.success('模型已删除')
    await loadModelList()
  } else {
    message.error(`删除失败: ${result.error}`)
  }
}

async function saveAdvancedSettings() {
  advancedSettings.value = persistAdvancedSettings(advancedSettings.value)
  await applyLogLevelSetting(advancedSettings.value.logLevel)
  message.success('高级设置已保存')
}

function handleShortcutKeyDown(event: KeyboardEvent) {
  event.preventDefault()

  const keys: string[] = []
  if (event.ctrlKey || event.metaKey) keys.push('Ctrl')
  if (event.altKey) keys.push('Alt')
  if (event.shiftKey) keys.push('Shift')

  const key = event.key.toUpperCase()
  if (key.length === 1 && /[A-Z0-9]/.test(key)) {
    keys.push(key)
  } else if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(event.key)) {
    keys.push(event.key)
  }

  if (keys.length > 1) {
    advancedSettings.value.recordingShortcut = keys.join('+')
    shortcutRegistered.value = false
  }
}

function convertToElectronFormat(shortcut: string): string {
  return shortcut.replace('Ctrl', 'CommandOrControl')
}

async function handleClearShortcut() {
  await window.electron.shortcut.unregister()
  advancedSettings.value.recordingShortcut = ''
  shortcutRegistered.value = false
  message.success('快捷键已清除')
}

async function handleRegisterShortcut() {
  if (!advancedSettings.value.recordingShortcut) {
    message.warning('请先设置快捷键')
    return
  }

  const electronFormat = convertToElectronFormat(advancedSettings.value.recordingShortcut)
  const result = await window.electron.shortcut.register(electronFormat)

  if (result.success) {
    shortcutRegistered.value = true
    await saveAdvancedSettings()
    message.success('快捷键注册成功')
  } else {
    message.error(`注册失败: ${result.error}`)
  }
}

async function handleOpenLogs() {
  const result = await window.electron.log.openDirectory()
  if (result.success) {
    message.success(`已打开日志目录: ${result.path}`)
    return
  }

  message.error(`打开日志目录失败: ${result.error || '未知错误'}`)
}

async function handleCheckUpdates() {
  checkingUpdate.value = true
  try {
    const result = await window.electron.update.check()
    if (result.success) {
      message.info(result.message)
    } else {
      message.warning(result.message)
    }
  } catch (error: any) {
    message.error(`检查更新失败: ${error?.message || String(error)}`)
  } finally {
    checkingUpdate.value = false
  }
}

async function handleInstallUpdate() {
  try {
    const result = await window.electron.update.quitAndInstall()
    if (!result.success) {
      message.warning(result.message)
    }
  } catch (error: any) {
    message.error(`安装更新失败: ${error?.message || String(error)}`)
  }
}

function handleClearCache() {
  dialog.warning({
    title: '清除缓存',
    content: '确定要清除所有缓存数据吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      const lastModelPath = localStorage.getItem('lastModelPath')
      const advancedSettingsStr = localStorage.getItem('advancedSettings')
      const connectionSettingsStr = localStorage.getItem('connectionSettings')
      const themeStateStr = localStorage.getItem('rendererThemeState')

      localStorage.clear()

      if (lastModelPath) localStorage.setItem('lastModelPath', lastModelPath)
      if (advancedSettingsStr) localStorage.setItem('advancedSettings', advancedSettingsStr)
      if (connectionSettingsStr) localStorage.setItem('connectionSettings', connectionSettingsStr)
      if (themeStateStr) localStorage.setItem('rendererThemeState', themeStateStr)

      message.success('缓存已清除')
    },
  })
}

function handleResetSettings() {
  dialog.error({
    title: '重置设置',
    content: '确定要重置所有设置吗？此操作不可恢复！',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      localStorage.clear()
      advancedSettings.value = normalizeAdvancedSettings(DEFAULT_ADVANCED_SETTINGS)
      persistAdvancedSettings(advancedSettings.value)
      void applyLogLevelSetting(advancedSettings.value.logLevel)
      shortcutRegistered.value = false
      message.success('设置已重置')
    },
  })
}

function handleOpenLink(url: string) {
  ;(window.electron.window as any).openExternal(url)
}
</script>

<style scoped lang="scss">
.settings-page {
  min-height: 100vh;
  padding: 24px;
  overflow-y: auto;
  background:
    radial-gradient(circle at top right, rgba(var(--color-accent-rgb), 0.12), transparent 26%),
    linear-gradient(180deg, var(--color-bg-light), var(--color-bg-dark) 42%);
}

.settings-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.settings-page__title {
  display: flex;
  flex-direction: column;
  gap: 6px;

  h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.05em;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
  }
}

.settings-page__eyebrow {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-tertiary);
}

.settings-page__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.settings-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 8px 12px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary);

  strong {
    color: var(--color-text-primary);
    font-weight: 600;
  }
}

.settings-page__content {
  padding-top: 18px;
}

.settings-nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.settings-nav__item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  color: var(--color-text-secondary);
  transition: background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.08);
    border-color: rgba(var(--color-accent-rgb), 0.18);
    color: var(--color-text-primary);
  }

  &--active {
    background: rgba(var(--color-accent-rgb), 0.16);
    border-color: rgba(var(--color-accent-rgb), 0.32);
    color: var(--color-text-primary);
  }
}

.settings-grid {
  align-items: stretch;
}

.settings-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h3 {
    margin: 0 0 6px;
    font-size: 18px;
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
  }
}

.settings-card__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.settings-form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.settings-summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.04);

  span {
    color: var(--color-text-secondary);
  }

  strong {
    max-width: 60%;
    text-align: right;
    word-break: break-word;
  }
}

.settings-theme-swatch {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-block;
}

.shortcut-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.shortcut-row :deep(.n-input) {
  flex: 1 1 220px;
}

.model-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(var(--color-accent-rgb), 0.22);
    box-shadow: var(--shadow-md);
  }

  &--active {
    border-color: rgba(var(--color-accent-rgb), 0.32);
    box-shadow: inset 0 0 0 1px rgba(var(--color-accent-rgb), 0.18);
  }
}

.model-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  color: var(--theme-accent-contrast);
  font-size: 22px;
  font-weight: 700;
}

.model-card__body {
  strong {
    display: block;
    margin-bottom: 6px;
    font-size: 16px;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
    word-break: break-word;
  }
}

.model-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.link-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 960px) {
  .settings-page {
    padding: 18px;
  }

  .settings-page__header,
  .settings-card__header,
  .settings-summary-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings-page__meta {
    justify-content: flex-start;
  }

  .settings-summary-row strong {
    max-width: none;
    text-align: left;
  }
}
</style>
