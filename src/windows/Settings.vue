<template>
  <div class="settings-window">
    <header class="settings-titlebar window-drag-region" @dblclick="handleTitleBarDoubleClick">
      <div class="settings-titlebar__brand">
        <span class="settings-titlebar__view">设置</span>
      </div>

      <div class="settings-titlebar__actions window-no-drag">
        <button class="settings-titlebar__button" type="button" aria-label="最小化" @click="handleMinimizeWindow">
          <Minus :size="16" />
        </button>
        <button
          class="settings-titlebar__button"
          type="button"
          :aria-label="isWindowMaximized ? '还原' : '最大化'"
          @click="handleToggleWindowMaximize"
        >
          <component :is="isWindowMaximized ? Copy : Square" :size="14" />
        </button>
        <button
          class="settings-titlebar__button settings-titlebar__button--close"
          type="button"
          aria-label="关闭"
          @click="handleCloseWindow"
        >
          <X :size="16" />
        </button>
      </div>
    </header>

    <div class="settings-workspace">
      <!-- 左栏：一级导航 -->
      <nav class="settings-primary-nav">
        <n-tooltip
          v-for="group in menuGroups"
          :key="group.key"
          placement="right"
          :show-arrow="false"
          trigger="hover"
        >
          <template #trigger>
            <button
              class="settings-primary-nav__item"
              :class="{ 'settings-primary-nav__item--active': activeGroup === group.key }"
              type="button"
              @click="handleSelectGroup(group.key)"
            >
              <component :is="group.icon" :size="20" />
            </button>
          </template>
          {{ group.label }}
        </n-tooltip>
      </nav>

      <!-- 中栏：二级导航 -->
      <aside class="settings-secondary-nav">
        <transition name="slide-fade" mode="out-in">
          <div class="settings-secondary-nav__header" :key="activeGroup">
            <strong>{{ activeGroupMeta.label }}</strong>
          </div>
        </transition>
        <transition name="list-fade" mode="out-in">
          <div class="settings-secondary-nav__list" :key="activeGroup">
            <button
              v-for="item in activeGroupChildren"
              :key="item.key"
              class="settings-secondary-nav__item"
              :class="{ 'settings-secondary-nav__item--active': activeChild === item.key }"
              type="button"
              @click="activeChild = item.key"
            >
              <span>{{ item.label }}</span>
            </button>
          </div>
        </transition>
      </aside>

      <!-- 右栏：内容区域 -->
      <main class="settings-content">
        <transition name="page-fade" mode="out-in">
          <div class="settings-content__viewport" :key="`${activeGroup}-${activeChild}`">
          <!-- 连接 > Bridge 连接 -->
          <template v-if="activeGroup === 'connection' && activeChild === 'bridge'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>Bridge 连接</h2>
                <span class="status-pill" :class="isConnected ? 'status-pill--success' : 'status-pill--warning'">
                  {{ isConnected ? '已连接' : '未连接' }}
                </span>
              </div>
              <p class="settings-section__desc">连接到 AstrBot Bridge 以控制 Live2D 模型和接收消息。</p>

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

              <div class="settings-section__actions">
                <n-button
                  type="primary"
                  secondary
                  :loading="savingConnectionSettings"
                  :disabled="!hasUnsavedConnectionSettings"
                  @click="handleSaveConnectionSettings"
                >
                  保存连接配置
                </n-button>
                <n-button type="primary" @click="handleConnect" :disabled="isConnected || !token.trim()">
                  {{ isConnected ? '已连接' : '连接服务器' }}
                </n-button>
                <n-button @click="handleDisconnect" :disabled="!isConnected">
                  断开连接
                </n-button>
              </div>
            </section>

            <section class="settings-section">
              <div class="settings-section__header">
                <h2>资源服务</h2>
              </div>
              <p class="settings-section__desc">配置图片、音频、视频等资源的访问地址。默认复用 WebSocket 连接地址。</p>

              <n-form label-placement="top">
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

          <!-- 连接 > 工作区状态 -->
          <template v-else-if="activeGroup === 'connection' && activeChild === 'workspace'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>工作区状态</h2>
              </div>
              <p class="settings-section__desc">当前连接和会话的运行状态信息。</p>

              <div class="settings-kv-list">
                <div class="settings-kv-list__row">
                  <span>连接状态</span>
                  <strong>{{ isConnected ? '在线' : '离线' }}</strong>
                </div>
                <div class="settings-kv-list__row">
                  <span>用户 ID</span>
                  <strong>{{ connectionStore.userId || '尚未分配' }}</strong>
                </div>
                <div class="settings-kv-list__row">
                  <span>会话 ID</span>
                  <strong>{{ connectionStore.sessionId || '尚未建立' }}</strong>
                </div>
                <div class="settings-kv-list__row">
                  <span>资源地址</span>
                  <strong>{{ connectionStore.resourceBaseUrl || '自动跟随' }}</strong>
                </div>
                <div class="settings-kv-list__row">
                  <span>资源路径</span>
                  <strong>{{ connectionStore.resourcePath || '/resources' }}</strong>
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

          <!-- 模型 > 当前模型 -->
          <template v-else-if="activeGroup === 'model' && activeChild === 'current'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>当前模型</h2>
                <span class="status-pill" :class="currentModelStatusClass">
                  {{ currentModelStatusLabel }}
                </span>
              </div>
              <p class="settings-section__desc">查看当前加载的 Live2D 模型信息，并确认当前主题色是否来自模型配色。</p>

              <template v-if="currentModelPath">
                <div class="current-model-info">
                  <div class="current-model-info__preview" :style="themeSwatchStyle">
                    <span>{{ currentModelInitial }}</span>
                  </div>
                  <div class="current-model-info__meta">
                    <strong>{{ currentModelDisplay }}</strong>
                    <span class="current-model-info__color">{{ sourceColor.toUpperCase() }}</span>
                    <code class="settings-inline-path">{{ currentModelPath }}</code>
                  </div>
                </div>
              </template>
              <n-empty v-else description="当前未加载模型" />
            </section>

            <section class="settings-section">
              <div class="settings-section__header">
                <h2>模型偏好</h2>
              </div>
              <p class="settings-section__desc">配置主题色跟随策略。切换后立即生效。</p>

              <n-form label-placement="top">
                <n-form-item label="主题色跟随当前模型">
                  <n-switch v-model:value="advancedSettings.themeFollowModel" @update:value="handleThemeFollowChange" />
                  <template #feedback>
                    启用后，界面主题会跟随当前模型配色；关闭后将保留手动或已有主题设置。
                  </template>
                </n-form-item>
              </n-form>

              <div class="settings-kv-list">
                <div class="settings-kv-list__row">
                  <span>当前主题色</span>
                  <strong>{{ sourceColor.toUpperCase() }}</strong>
                </div>
                <div class="settings-kv-list__row">
                  <span>同步状态</span>
                  <strong>{{ advancedSettings.themeFollowModel ? (currentModelPath ? '跟随当前模型' : '等待模型加载') : '已关闭自动同步' }}</strong>
                </div>
              </div>
            </section>
          </template>

          <!-- 模型 > 模型库 -->
          <template v-else-if="activeGroup === 'model' && activeChild === 'library'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>模型库</h2>
                <n-button type="primary" size="small" @click="handleImportModel">导入模型</n-button>
              </div>
              <p class="settings-section__desc">管理本地 Live2D 模型文件。共 {{ modelList.length }} 个模型。</p>

              <div v-if="modelList.length > 0" class="model-grid">
                <article
                  v-for="model in modelList"
                  :key="model.name"
                  class="model-card"
                  :class="{ 'model-card--active': currentModelPath === model.path }"
                >
                  <div class="model-card__top">
                    <div class="model-card__preview" :style="getModelPreviewStyle(model.path)">
                      <span>{{ model.name.slice(0, 1).toUpperCase() }}</span>
                    </div>
                    <span v-if="currentModelPath === model.path" class="model-card__badge">当前</span>
                  </div>
                  <div class="model-card__body">
                    <strong>{{ model.name }}</strong>
                    <code>{{ model.path }}</code>
                  </div>
                  <div class="model-card__actions">
                    <n-button size="small" type="primary" @click="handleLoadModel(model.path)">
                      {{ currentModelPath === model.path ? '重新加载' : '加载' }}
                    </n-button>
                    <n-button size="small" tertiary type="error" @click="handleDeleteModel(model.name)">删除</n-button>
                  </div>
                </article>
              </div>
              <n-empty v-else description="暂无模型，请先导入" />
            </section>
          </template>

          <!-- 历史 > 消息列表 -->
          <template v-else-if="activeGroup === 'history' && activeChild === 'messages'">
            <section class="settings-section settings-section--fill">
              <div class="settings-section__header">
                <h2>消息列表</h2>
                <div class="history-toolbar-actions">
                  <n-input
                    v-model:value="keyword"
                    placeholder="搜索消息..."
                    clearable
                    size="small"
                    @update:value="handleSearch"
                  >
                    <template #prefix>
                      <Search :size="14" />
                    </template>
                  </n-input>
                  <n-select
                    v-model:value="directionFilter"
                    :options="directionOptions"
                    placeholder="方向"
                    clearable
                    size="small"
                    style="width: 100px"
                    @update:value="loadMessages"
                  />
                  <n-button size="small" type="error" @click="handleClearHistory">清空</n-button>
                  <n-button size="small" type="primary" @click="handleRefreshHistory">刷新</n-button>
                </div>
              </div>
              <p class="settings-section__desc">共 {{ totalMessages }} 条消息</p>

              <div class="message-list">
                <article
                  v-for="msg in messages"
                  :key="msg.id"
                  :class="[
                    'message-item',
                    `message-item--${msg.direction}`,
                  ]"
                >
                  <div class="message-avatar">
                    <span class="message-avatar__icon">
                      <component :is="msg.direction === 'outgoing' ? User : Bot" :size="14" />
                    </span>
                  </div>

                  <div class="message-bubble">
                    <div class="message-bubble__header">
                      <strong class="message-bubble__name">{{ getMessageAuthorLabel(msg) }}</strong>
                      <span class="message-bubble__time">{{ formatTimestamp(msg.timestamp) }}</span>
                    </div>

                    <div class="message-bubble__body">
                      <div v-for="(item, idx) in parseContent(msg.content)" :key="idx" class="content-item">
                        <div v-if="item.type === 'text'" class="text-content" v-html="renderMarkdown(item.text || item.content)"></div>
                        <div v-else-if="item.type === 'image'" class="image-content">
                          <n-image
                            v-if="resolveMessageImageSource(item)"
                            :src="resolveMessageImageSource(item) || undefined"
                            :preview-src="resolveMessageImageSource(item) || undefined"
                            width="220"
                            object-fit="cover"
                            preview-disabled
                            :lazy="true"
                          />
                          <div v-else class="media-placeholder">
                            <ImageIcon :size="16" />
                            <span>图片</span>
                          </div>
                        </div>
                        <div v-else-if="item.type === 'audio'" class="voice-bubble" @click="toggleVoicePlay(item, idx)">
                          <div class="voice-bubble__icon">
                            <Mic :size="16" />
                          </div>
                          <div class="voice-bubble__wave">
                            <span></span><span></span><span></span><span></span><span></span>
                          </div>
                          <span class="voice-bubble__duration">{{ item.duration || "''" }}</span>
                          <audio
                            :ref="el => setVoiceRef(el, idx)"
                            :src="resolveMessageAudioSource(item) || undefined"
                            preload="metadata"
                            @ended="onVoiceEnded(idx)"
                          ></audio>
                        </div>
                        <div v-else-if="item.type === 'video'" class="video-content">
                          <template v-if="resolveMessageVideoSource(item)">
                            <video class="video-player" :src="resolveMessageVideoSource(item) || undefined" controls preload="metadata" playsinline></video>
                          </template>
                          <div v-else class="media-placeholder">
                            <Video :size="16" />
                            <span>视频</span>
                          </div>
                        </div>
                        <div v-else-if="item.type === 'file'" class="file-content">
                          <template v-if="resolveMessageFileSource(item)">
                            <div class="file-header">
                              <div class="file-meta">
                                <FileText :size="16" />
                                <span class="file-name">{{ item.name || '文件' }}</span>
                              </div>
                              <div class="file-actions">
                                <button class="file-action-btn" @click="openHistoryFile(item)">
                                  <ExternalLink :size="12" />
                                </button>
                                <button class="file-action-btn" @click="downloadHistoryFile(item)">
                                  <Download :size="12" />
                                </button>
                              </div>
                            </div>
                          </template>
                          <div v-else class="media-placeholder">
                            <FileText :size="16" />
                            <span>{{ item.name || '文件' }}</span>
                          </div>
                        </div>
                        <div v-else class="text-content">{{ item.type }}</div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <n-pagination
                v-if="totalPages > 1"
                v-model:page="currentPage"
                :page-count="totalPages"
                :page-size="pageSize"
                show-size-picker
                :page-sizes="[10, 20, 50]"
                @update:page="loadMessages"
                @update:page-size="handlePageSizeChange"
                class="history-pagination"
              />
            </section>
          </template>

          <!-- 历史 > 统计概览 -->
          <template v-else-if="activeGroup === 'history' && activeChild === 'statistics'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>统计概览</h2>
                <n-date-picker
                  v-model:value="dateRange"
                  type="daterange"
                  clearable
                  size="small"
                  @update:value="handleDateRangeChange"
                />
              </div>
              <p class="settings-section__desc">消息趋势和内容分布统计。</p>

              <div class="chart-grid">
                <div class="chart-card">
                  <h3>消息趋势</h3>
                  <div ref="messageTrendRef" class="chart-container"></div>
                </div>
                <div class="chart-card">
                  <h3>内容分布</h3>
                  <div ref="performElementRef" class="chart-container"></div>
                </div>
                <div class="chart-card chart-card--wide">
                  <h3>活跃时段</h3>
                  <div ref="activeHoursRef" class="chart-container"></div>
                </div>
              </div>
            </section>
          </template>

          <!-- 高级 > 行为配置 -->
          <template v-else-if="activeGroup === 'advanced' && activeChild === 'behavior'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>行为配置</h2>
              </div>
              <p class="settings-section__desc">配置应用启动行为、通知策略和日志级别。切换后立即生效。</p>

              <n-form label-placement="top">
                <div class="settings-toggle-item">
                  <div class="settings-toggle-item__main">
                    <div class="settings-toggle-item__label">启动时自动连接</div>
                  </div>
                  <n-switch v-model:value="advancedSettings.autoConnect" @update:value="applyAdvancedSettingChange" />
                </div>
                <div class="settings-toggle-item">
                  <div class="settings-toggle-item__main">
                    <div class="settings-toggle-item__label">启动时自动加载上次模型</div>
                  </div>
                  <n-switch v-model:value="advancedSettings.autoLoadLastModel" @update:value="applyAdvancedSettingChange" />
                </div>
                <div class="settings-toggle-item">
                  <div class="settings-toggle-item__main">
                    <div class="settings-toggle-item__label">音频播放时启用口型同步</div>
                    <div class="settings-toggle-item__desc">关闭后仍会播放音频，但不会再驱动模型口型变化。</div>
                  </div>
                  <n-switch v-model:value="advancedSettings.lipSyncEnabled" @update:value="applyAdvancedSettingChange" />
                </div>
                <div class="settings-toggle-item">
                  <div class="settings-toggle-item__main">
                    <div class="settings-toggle-item__label">录音时启用静音检测</div>
                    <div class="settings-toggle-item__desc">长时间未检测到声音时自动结束录音，减少空白语音片段。</div>
                  </div>
                  <n-switch v-model:value="advancedSettings.silenceDetectionEnabled" @update:value="applyAdvancedSettingChange" />
                </div>
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
                  <n-switch
                    :value="desktopFeatureSettings.alwaysOnTop"
                    @update:value="(value: boolean) => updateDesktopFeatureSetting('alwaysOnTop', value)"
                  />
                  <template #feedback>
                    保持桌面角色窗口位于普通应用之上，适合需要持续显示角色的场景。
                  </template>
                </n-form-item>
                <n-form-item label="始终穿透">
                  <n-switch
                    :value="desktopFeatureSettings.fullPassThrough"
                    @update:value="(value: boolean) => updateDesktopFeatureSetting('fullPassThrough', value)"
                  />
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

          <!-- 高级 > 快捷键 -->
          <template v-else-if="activeGroup === 'advanced' && activeChild === 'shortcut'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>快捷键</h2>
              </div>
              <p class="settings-section__desc">配置全局录音快捷键和录音时长限制。</p>

              <n-form label-placement="top">
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
                      @update:value="applyAdvancedSettingChange"
                    />
                    <span>秒（上限 60 秒）</span>
                  </n-space>
                </n-form-item>
              </n-form>
            </section>
          </template>

          <!-- 高级 > 窗口监听 -->
          <template v-else-if="activeGroup === 'advanced' && activeChild === 'window-watcher'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>窗口监听</h2>
                <n-switch 
                  v-model:value="watcherConfig.enabled" 
                  @update:value="saveWatcherConfig"
                />
              </div>
              <p class="settings-section__desc">监听窗口变化，让 AI 主动感知你的操作。启用后，AI 会在你打开应用时主动响应。</p>
            </section>

            <section class="settings-section">
              <div class="settings-section__header">
                <h2>主动触发策略</h2>
              </div>
              <p class="settings-section__desc">将应用启动时的主动提醒拆分为单独开关，便于只保留窗口上下文感知。</p>

              <n-form label-placement="top">
                <n-form-item label="启用应用启动监听">
                  <n-switch v-model:value="watcherConfig.appLaunchEnabled" @update:value="saveWatcherConfig" />
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
                  <n-input-number
                    v-model:value="watcherConfig.throttle.globalInterval"
                    :min="0"
                    :max="60000"
                    :step="100"
                    placeholder="默认 1000ms"
                    @update:value="saveWatcherConfig"
                  />
                  <template #feedback>
                    两次事件之间的最小间隔。默认 1000ms（1秒）。
                  </template>
                </n-form-item>

                <n-form-item label="单窗口频率限制（毫秒）">
                  <n-input-number
                    v-model:value="watcherConfig.throttle.perWindowInterval"
                    :min="0"
                    :max="60000"
                    :step="100"
                    placeholder="默认 3000ms"
                    @update:value="saveWatcherConfig"
                  />
                  <template #feedback>
                    同一窗口两次事件之间的最小间隔。默认 3000ms（3秒）。
                  </template>
                </n-form-item>

                <n-form-item label="最小间隔（毫秒）">
                  <n-input-number
                    v-model:value="watcherConfig.throttle.minInterval"
                    :min="0"
                    :max="1000"
                    :step="10"
                    placeholder="默认 100ms"
                    @update:value="saveWatcherConfig"
                  />
                  <template #feedback>
                    防止过于频繁的触发。默认 100ms。
                  </template>
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
                  <n-switch v-model:value="watcherConfig.events.focus" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口失去焦点">
                  <n-switch v-model:value="watcherConfig.events.blur" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="新窗口创建">
                  <n-switch v-model:value="watcherConfig.events.create" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口关闭">
                  <n-switch v-model:value="watcherConfig.events.destroy" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口进入全屏">
                  <n-switch v-model:value="watcherConfig.events.fullscreen" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口退出全屏">
                  <n-switch v-model:value="watcherConfig.events.windowed" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口大小变化">
                  <n-switch v-model:value="watcherConfig.events.resize" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口位置变化">
                  <n-switch v-model:value="watcherConfig.events.move" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口最小化">
                  <n-switch v-model:value="watcherConfig.events.minimize" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口最大化">
                  <n-switch v-model:value="watcherConfig.events.maximize" @update:value="saveWatcherConfig" />
                </n-form-item>

                <n-form-item label="窗口恢复">
                  <n-switch v-model:value="watcherConfig.events.restore" @update:value="saveWatcherConfig" />
                </n-form-item>
              </n-form>
            </section>

            <section class="settings-section">
              <div class="settings-section__header">
                <h2>AI 响应模式</h2>
              </div>
              <p class="settings-section__desc">选择 AI 响应窗口事件的方式。</p>

              <n-radio-group v-model:value="watcherConfig.aiResponse.mode" @update:value="saveWatcherConfig">
                <n-space direction="vertical">
                  <n-radio value="first-open">仅首次打开应用时响应</n-radio>
                  <n-radio value="every-switch">每次应用切换都响应</n-radio>
                  <n-radio value="specific-apps">仅检测到特定应用时响应</n-radio>
                </n-space>
              </n-radio-group>

              <div v-if="watcherConfig.aiResponse.mode === 'specific-apps'" class="specific-apps-config">
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
                  进程：dwm.exe, csrss.exe, explorer.exe, SearchUI.exe 等系统进程<br/>
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
                  <template #feedback>
                    这些进程名会与内置规则合并，用于过滤不需要触发 AI 响应的进程。
                  </template>
                </n-form-item>

                <n-form-item label="额外忽略的窗口标题关键词（每行一个）">
                  <n-input
                    v-model:value="ignoreTitleKeywordsInput"
                    type="textarea"
                    :rows="3"
                    placeholder="输入额外要忽略的标题关键词..."
                    @update:value="updateIgnoreTitleKeywords"
                  />
                  <template #feedback>
                    标题包含这些关键词的窗口会被忽略。
                  </template>
                </n-form-item>
              </n-form>
            </section>

            <section class="settings-section">
              <div class="settings-section__actions">
                <n-button @click="resetWatcherConfig">重置配置</n-button>
              </div>
            </section>
          </template>

          <!-- 高级 > 数据管理 -->
          <template v-else-if="activeGroup === 'advanced' && activeChild === 'data'">
            <section class="settings-section">
              <div class="settings-section__header">
                <h2>数据管理</h2>
              </div>
              <p class="settings-section__desc">管理应用缓存、日志和设置数据。</p>

              <div class="settings-section__actions">
                <n-button @click="handleOpenLogs">打开日志目录</n-button>
                <n-button @click="handleClearCache">清除缓存</n-button>
                <n-button type="error" @click="handleResetSettings">重置所有设置</n-button>
              </div>
            </section>
          </template>

          <!-- 关于 -->
          <template v-else-if="activeGroup === 'about' && activeChild === 'info'">
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
              <p class="settings-section__note">
                Powered by Live2D
              </p>
            </section>
          </template>
          </div>
        </transition>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDialog, useMessage } from 'naive-ui'
import { useDebounceFn } from '@vueuse/core'
import * as echarts from 'echarts'
import { format } from 'date-fns'
import {
  Copy, Drama, Globe, Info, Minus, Settings, Square, X,
  MessageSquare, Search, User, Bot, Image as ImageIcon, Mic, Video,
  FileText, ExternalLink, Download
} from 'lucide-vue-next'
import { useConnectionStore } from '@/stores/connection'
import { useThemeStore } from '@/stores/theme'
import {
  APP_LINKS,
  APP_METADATA,
  SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS,
} from '@/shared/metadata'
import {
  DEFAULT_ADVANCED_SETTINGS,
  clampMaxRecordingSeconds,
  loadAdvancedSettings,
  normalizeAdvancedSettings,
  saveAdvancedSettings as persistAdvancedSettings,
} from '@/utils/advancedSettings'
import {
  getLruCacheEntry,
  setLruCacheEntry,
  resolveHistoryMediaSource,
  parseHistoryContent,
  resolveHistoryImageSource,
  type HistoryContentElement,
} from '@/utils/historyContent'
import { withAlpha } from '@/utils/themePalette'
import { DEFAULT_DESKTOP_FEATURE_SETTINGS } from '@/utils/desktopFeatureSettings'
import { DEFAULT_UPDATER_SETTINGS } from '@/utils/updaterSettings'
import { DEFAULT_SCREENSHOT_SETTINGS } from '@/utils/screenshotSettings'
import { configureMarked, renderBubbleMarkdown as renderMarkdownFromShared } from '@/utils/markedLatex'
import { buildDefaultConnectionSettingsEditable } from '@/shared/connectionSettings'

const message = useMessage()
const dialog = useDialog()
const connectionStore = useConnectionStore()
const themeStore = useThemeStore()
const { currentModelPath, resolvedModelName, palette, sourceColor } = storeToRefs(themeStore)
const {
  isConnected,
  serverUrl,
  token,
  customResourceBaseUrl: resourceServerUrl,
  customResourcePath: resourceServerPath,
  customResourceToken: resourceAccessToken,
  hasUnsavedChanges: hasUnsavedConnectionSettings,
} = storeToRefs(connectionStore)

configureMarked()

// 菜单数据结构
const menuGroups = [
  {
    key: 'connection',
    icon: Globe,
    label: '连接',
    children: [
      { key: 'bridge', label: 'Bridge 连接' },
      { key: 'workspace', label: '工作区状态' },
    ],
  },
  {
    key: 'model',
    icon: Drama,
    label: '模型',
    children: [
      { key: 'current', label: '当前模型' },
      { key: 'library', label: '模型库' },
    ],
  },
  {
    key: 'history',
    icon: MessageSquare,
    label: '历史',
    children: [
      { key: 'messages', label: '消息列表' },
      { key: 'statistics', label: '统计概览' },
    ],
  },
  {
    key: 'advanced',
    icon: Settings,
    label: '高级',
    children: [
      { key: 'behavior', label: '行为配置' },
      { key: 'shortcut', label: '快捷键' },
      { key: 'window-watcher', label: '窗口监听' },
      { key: 'data', label: '数据管理' },
    ],
  },
  {
    key: 'about',
    icon: Info,
    label: '关于',
    children: [
      { key: 'info', label: '关于' },
    ],
  },
]

// 状态
const activeGroup = ref('connection')
const activeChild = ref('bridge')
const savingConnectionSettings = ref(false)
const modelList = ref<Array<{ name: string; path: string }>>([])
const appVersion = ref('')
const platformCapabilities = ref<PlatformCapabilities | null>(null)
const updateState = ref<UpdateState | null>(null)
const checkingUpdate = ref(false)
const advancedSettings = ref({
  ...DEFAULT_ADVANCED_SETTINGS,
})
const desktopFeatureSettings = ref({
  alwaysOnTop: DEFAULT_DESKTOP_FEATURE_SETTINGS.alwaysOnTop,
  fullPassThrough: DEFAULT_DESKTOP_FEATURE_SETTINGS.fullPassThrough,
  dynamicPassThrough: DEFAULT_DESKTOP_FEATURE_SETTINGS.dynamicPassThrough,
  autoDetectFullscreen: DEFAULT_DESKTOP_FEATURE_SETTINGS.autoDetectFullscreen,
})
const updaterSettings = ref({
  autoUpdateEnabled: true,
})
const screenshotSettings = ref({
  defaultTarget: 'active' as 'active' | 'desktop',
  quality: 80,
  maxWidth: 1920,
})
const shortcutRegistered = ref(false)
const isWindowMaximized = ref(false)

// 窗口监听配置状态
type AIResponseMode = 'first-open' | 'every-switch' | 'specific-apps'

const watcherConfig = ref({
  enabled: true,
  appLaunchEnabled: true,
  throttle: {
    globalInterval: 1000,
    perWindowInterval: 3000,
    minInterval: 100,
  },
  events: {
    focus: true,
    blur: false,
    create: true,
    destroy: false,
    fullscreen: true,
    windowed: false,
    resize: false,
    move: false,
    minimize: false,
    maximize: false,
    restore: false,
  },
  ignore: {
    processNames: ['dwm.exe', 'csrss.exe', 'explorer.exe'],
    titleKeywords: ['Program Manager', '锁屏', 'Lock Screen'],
  },
  aiResponse: {
    mode: 'first-open' as AIResponseMode,
    specificApps: [] as string[],
  },
})

// 用于 textarea 显示的字符串（每行一个）
const specificAppsInput = ref('')
const ignoreProcessNamesInput = ref('')
const ignoreTitleKeywordsInput = ref('')

// 历史记录状态
const messages = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(0)
const totalMessages = ref(0)
const keyword = ref('')
const directionFilter = ref<string>()
const dateRange = ref<[number, number] | null>([
  Date.now() - 7 * 24 * 60 * 60 * 1000,
  Date.now(),
])
const statisticsData = ref<any[]>([])
const historyResourceBaseUrl = ref('')
const historyResourcePath = ref('/resources')
const historyResourceToken = ref('')

// 图表引用
const messageTrendRef = ref<HTMLElement>()
const performElementRef = ref<HTMLElement>()
const activeHoursRef = ref<HTMLElement>()
let charts: echarts.ECharts[] = []

// 语音播放状态
const voiceRefs = new Map<number, HTMLAudioElement>()
const playingVoiceIdx = ref<number | null>(null)

function setVoiceRef(el: any, idx: number) {
  if (el) {
    voiceRefs.set(idx, el as HTMLAudioElement)
  } else {
    voiceRefs.delete(idx)
  }
}

function toggleVoicePlay(_item: any, idx: number) {
  const audio = voiceRefs.get(idx)
  if (!audio) return

  // 停止其他正在播放的语音
  if (playingVoiceIdx.value !== null && playingVoiceIdx.value !== idx) {
    const prevAudio = voiceRefs.get(playingVoiceIdx.value)
    if (prevAudio) {
      prevAudio.pause()
      prevAudio.currentTime = 0
    }
  }

  if (playingVoiceIdx.value === idx) {
    audio.pause()
    audio.currentTime = 0
    playingVoiceIdx.value = null
  } else {
    audio.play().catch(() => {})
    playingVoiceIdx.value = idx
  }
}

function onVoiceEnded(idx: number) {
  if (playingVoiceIdx.value === idx) {
    playingVoiceIdx.value = null
  }
}

// 缓存
const markdownRenderCache = new Map<string, string>()
const messageContentCache = new Map<string, HistoryContentElement[]>()

// 计算属性
const activeGroupMeta = computed(() => {
  return menuGroups.find((g) => g.key === activeGroup.value) ?? menuGroups[0]
})

const activeGroupChildren = computed(() => {
  return activeGroupMeta.value.children
})

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

const inactiveModelSwatchStyle = computed(() => ({
  background: 'linear-gradient(135deg, rgba(var(--color-accent-rgb), 0.18), rgba(255, 255, 255, 0.04))',
  boxShadow: 'none',
}))

const currentModelDisplay = computed(() => resolvedModelName.value || '尚未加载模型')
const currentModelInitial = computed(() => (currentModelDisplay.value || 'A').slice(0, 1).toUpperCase())
const currentModelStatusLabel = computed(() => (currentModelPath.value ? '使用中' : '未加载'))
const currentModelStatusClass = computed(() => (
  currentModelPath.value ? 'status-pill--accent' : 'status-pill--warning'
))

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
    ? '支持'
    : '不支持（当前平台无法稳定转发鼠标事件）'
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
        text: 'Wayland 会话下智能穿透与自动检测全屏应用不可用；建议在支持 X11 的环境中使用以获得更完整体验。',
      }
    }
    return {
      type: 'info',
      text: 'Linux 会话下智能穿透不可用，自动更新需通过 Releases 手动下载。',
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
  if (!updateState.value) return '更新状态未知'
  if (updateState.value.status === 'downloading' && typeof updateState.value.progress === 'number') {
    return `${updateState.value.message}（${Math.round(updateState.value.progress)}%）`
  }
  return updateState.value.message
})

const canInstallUpdate = computed(() => updateState.value?.status === 'downloaded')
const settingsWindowDisposers: Unsubscribe[] = []

// 监听页面切换，重新加载统计数据
watch([activeGroup, activeChild], async ([group, child]) => {
  if (group === 'history' && child === 'statistics') {
    // 等待 DOM 完全渲染（包括动画）
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 300))
    await loadStatistics()
  }
})

// 生命周期
onMounted(async () => {
  // 先设置监听，避免错过消息
  if (window.electron.settings?.onNavigateTo) {
    settingsWindowDisposers.push(window.electron.settings.onNavigateTo((page: string) => {
      navigateToPage(page)
    }))
  }

  themeStore.startStorageSync()
  await connectionStore.ensureInitialized()

  // 主动请求待处理的页面参数
  if (window.electron.settings?.getPendingPage) {
    const pendingPage = await window.electron.settings.getPendingPage()
    if (pendingPage) {
      navigateToPage(pendingPage)
    }
  }

  await loadModelList()
  loadSettings()
  await loadDesktopFeatureSettings()
  await loadUpdaterSettings()
  await loadScreenshotSettings()
  themeStore.syncFromStorage()
  await loadWatcherConfig()

  try {
    isWindowMaximized.value = await window.electron.window.isMaximizedCurrent()
  } catch {
    isWindowMaximized.value = false
  }

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

  settingsWindowDisposers.push(window.electron.update.onStateChanged((state: UpdateState) => {
    updateState.value = state
  }))

  settingsWindowDisposers.push(window.electron.window.onMaximizedChanged((maximized: boolean) => {
    isWindowMaximized.value = maximized
  }))

  settingsWindowDisposers.push(window.electron.desktopBehavior.onSnapshotChanged((snapshot: DesktopBehaviorSnapshot) => {
    applyDesktopFeatureSettingsState(snapshot.preferences)
  }))

  settingsWindowDisposers.push(window.electron.connectionSettings.onChanged(async () => {
    if (hasUnsavedConnectionSettings.value) {
      message.warning('检测到其他窗口更新了连接配置，请先保存或放弃当前修改后再同步')
      return
    }

    await connectionStore.reloadPersistedSettings()
    await syncHistoryResourceConfig()
  }))

  await checkShortcutRegistration()

  settingsWindowDisposers.push(window.electron.bridge.onConnected((payload: BridgeSessionState) => {
    connectionStore.handleConnected(payload)
  }))

  settingsWindowDisposers.push(window.electron.bridge.onDisconnected(() => {
    connectionStore.handleDisconnected()
  }))

  await connectionStore.checkConnection()

  // 初始化历史记录
  await syncHistoryResourceConfig()
  await loadMessages()
  await loadStatistics()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)

  // 根据 URL hash 跳转到相应页面
  navigateFromHash()

  // 监听 hash 变化
  window.addEventListener('hashchange', navigateFromHash)
})

onUnmounted(() => {
  charts.forEach(chart => chart.dispose())
  charts = []
  markdownRenderCache.clear()
  messageContentCache.clear()
  themeStore.stopStorageSync()
  for (const dispose of settingsWindowDisposers.splice(0)) {
    dispose()
  }
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('hashchange', navigateFromHash)
})

function handleResize() {
  charts.forEach(chart => chart.resize())
}

function navigateFromHash() {
  const hash = window.location.hash
  // 解析 hash，例如 #/settings/history -> history
  const match = hash.match(/#\/settings\/(.+)/)
  if (match && match[1]) {
    navigateToPage(match[1])
  }
}

function navigateToPage(page: string) {
  // page 格式: "history" 或 "history/messages"
  const parts = page.split('/')
  const group = parts[0]
  const child = parts[1]

  if (menuGroups.some(g => g.key === group)) {
    activeGroup.value = group
    const groupMeta = menuGroups.find(g => g.key === group)
    if (child && groupMeta?.children.some(c => c.key === child)) {
      activeChild.value = child
    } else if (groupMeta && groupMeta.children.length > 0) {
      activeChild.value = groupMeta.children[0].key
    }
  }
}

// 方法
function handleSelectGroup(key: string) {
  activeGroup.value = key
  const group = menuGroups.find((g) => g.key === key)
  if (group && group.children.length > 0) {
    activeChild.value = group.children[0].key
  }
}

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

function applyDesktopFeatureSettingsState(settings: DesktopFeatureSettings) {
  desktopFeatureSettings.value = {
    alwaysOnTop: Boolean(settings.alwaysOnTop),
    fullPassThrough: Boolean(settings.fullPassThrough),
    dynamicPassThrough: Boolean(settings.dynamicPassThrough),
    autoDetectFullscreen: Boolean(settings.autoDetectFullscreen),
  }
}

async function loadDesktopFeatureSettings() {
  try {
    applyDesktopFeatureSettingsState(await window.electron.desktopBehavior.getPreferences())
  } catch (error) {
    console.warn('[设置] 加载桌面功能设置失败:', error)
  }
}

async function loadUpdaterSettings() {
  try {
    const settings = await window.electron.update.getSettings()
    updaterSettings.value = {
      autoUpdateEnabled: Boolean(settings.autoUpdateEnabled),
    }
  } catch (error) {
    console.warn('[设置] 加载自动更新设置失败:', error)
  }
}

async function loadScreenshotSettings() {
  try {
    const settings = await window.electron.window.getScreenshotSettings()
    screenshotSettings.value = {
      defaultTarget: settings.defaultTarget === 'desktop' ? 'desktop' : 'active',
      quality: Number(settings.quality) || 80,
      maxWidth: Number(settings.maxWidth) || 1920,
    }
  } catch (error) {
    console.warn('[设置] 加载截图策略设置失败:', error)
  }
}

async function updateDesktopFeatureSetting(
  key: 'alwaysOnTop' | 'fullPassThrough' | 'dynamicPassThrough' | 'autoDetectFullscreen',
  value: boolean,
) {
  const previousSettings = { ...desktopFeatureSettings.value }
  const nextSettings = {
    ...desktopFeatureSettings.value,
    [key]: value,
  }

  desktopFeatureSettings.value = nextSettings

  try {
    const savedSettings = await window.electron.desktopBehavior.updatePreferences({
      alwaysOnTop: nextSettings.alwaysOnTop,
      fullPassThrough: nextSettings.fullPassThrough,
      dynamicPassThrough: nextSettings.dynamicPassThrough,
      autoDetectFullscreen: nextSettings.autoDetectFullscreen,
    })
    applyDesktopFeatureSettingsState(savedSettings)
    message.success('桌面交互设置已保存')
  } catch (error: any) {
    desktopFeatureSettings.value = previousSettings
    message.error(`保存失败: ${error?.message || String(error)}`)
  }
}

async function updateAutoUpdateSetting(value: boolean) {
  const previousSettings = { ...updaterSettings.value }
  updaterSettings.value = { autoUpdateEnabled: value }

  try {
    const nextSettings = await window.electron.update.updateSettings({
      autoUpdateEnabled: value,
    })
    updaterSettings.value = {
      autoUpdateEnabled: Boolean(nextSettings.autoUpdateEnabled),
    }
    message.success('自动更新设置已保存')
  } catch (error: any) {
    updaterSettings.value = previousSettings
    message.error(`保存失败: ${error?.message || String(error)}`)
  }
}

function createScreenshotSettingsPayload() {
  return {
    defaultTarget: screenshotSettings.value.defaultTarget,
    quality: screenshotSettings.value.quality,
    maxWidth: screenshotSettings.value.maxWidth,
  }
}

async function updateScreenshotSettings(patch: Partial<typeof screenshotSettings.value>) {
  const previousSettings = { ...screenshotSettings.value }
  screenshotSettings.value = {
    ...screenshotSettings.value,
    ...patch,
  }

  try {
    const nextSettings = await window.electron.window.updateScreenshotSettings(createScreenshotSettingsPayload())
    screenshotSettings.value = {
      defaultTarget: nextSettings.defaultTarget === 'desktop' ? 'desktop' : 'active',
      quality: Number(nextSettings.quality) || 80,
      maxWidth: Number(nextSettings.maxWidth) || 1920,
    }
    message.success('截图策略已保存')
  } catch (error: any) {
    screenshotSettings.value = previousSettings
    message.error(`保存失败: ${error?.message || String(error)}`)
  }
}

async function loadModelList() {
  const result = await window.electron.model.getList()
  if (result.success && result.models) {
    modelList.value = result.models
  }
}

async function handleSaveConnectionSettings() {
  if (savingConnectionSettings.value) {
    return
  }

  savingConnectionSettings.value = true
  try {
    const saveResult = await connectionStore.savePersistedSettings()
    if (saveResult.success) {
      message.success('连接配置已保存')
      await syncHistoryResourceConfig()
      return
    }

    message.error(`保存失败: ${saveResult.error}`)
  } finally {
    savingConnectionSettings.value = false
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

  serverUrl.value = targetUrl
  token.value = authToken
  resourceServerUrl.value = resourceServerUrl.value.trim()
  resourceServerPath.value = resourceServerPath.value.trim()
  resourceAccessToken.value = resourceAccessToken.value.trim()

  const result = await connectionStore.connect(targetUrl, authToken)
  if (result.success) {
    await syncHistoryResourceConfig()
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

// 历史记录相关方法
const directionOptions = [
  { label: '发送', value: 'outgoing' },
  { label: '接收', value: 'incoming' }
]

const debouncedLoadMessages = useDebounceFn(() => {
  void loadMessages()
}, 250)

async function syncHistoryResourceConfig() {
  await connectionStore.ensureInitialized()
  await connectionStore.reloadPersistedSettings()
  try {
    const session = await window.electron.bridge.getSession()
    connectionStore.applySessionState(session)
  } catch (error) {
    console.warn('[设置] 获取资源配置失败:', error)
  }
  historyResourceBaseUrl.value = connectionStore.resourceBaseUrl
  historyResourcePath.value = connectionStore.resourcePath
  historyResourceToken.value = connectionStore.resourceToken
}

async function loadMessages() {
  try {
    const options: any = {
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value
    }
    if (keyword.value) options.keyword = keyword.value
    if (directionFilter.value) options.direction = directionFilter.value

    const result = await window.electron.history.getMessages(options)
    if (result.success) {
      messages.value = result.data || []
      totalMessages.value = (result as any).total || 0
      totalPages.value = Math.ceil(totalMessages.value / pageSize.value) || 1
    }
  } catch (error: any) {
    message.error(`加载历史记录失败: ${error.message}`)
  }
}

async function loadStatistics() {
  if (!dateRange.value) {
    statisticsData.value = []
    renderCharts([])
    return
  }
  const [start, end] = dateRange.value
  const startDate = format(new Date(start), 'yyyy-MM-dd')
  const endDate = format(new Date(end), 'yyyy-MM-dd')

  try {
    const result = await window.electron.history.getStatistics(startDate, endDate)
    console.log('[设置] 统计数据响应:', result)
    if (result.success && result.data) {
      console.log('[设置] 统计数据:', result.data)
      statisticsData.value = result.data
      await nextTick()
      renderCharts(result.data)
    }
  } catch (error: any) {
    console.error('[设置] 加载统计数据失败:', error)
  }
}

function renderCharts(data: any[]) {
  charts.forEach(chart => chart.dispose())
  charts = []
  if (!data || data.length === 0) return

  console.log('[设置] 渲染图表, messageTrendRef:', messageTrendRef.value, 'performElementRef:', performElementRef.value, 'activeHoursRef:', activeHoursRef.value)

  const chartColors = palette.value.chartPalette
  const axisColor = 'rgba(255, 255, 255, 0.18)'
  const labelColor = palette.value.textSecondary
  const gridColor = 'rgba(255, 255, 255, 0.08)'
  const tooltipBackground = 'rgba(8, 12, 20, 0.92)'

  const commonOption = {
    backgroundColor: 'transparent',
    textStyle: { color: labelColor },
    tooltip: {
      backgroundColor: tooltipBackground,
      borderColor: axisColor,
      textStyle: { color: palette.value.textPrimary }
    },
  }

  if (messageTrendRef.value) {
    const chart = echarts.init(messageTrendRef.value)
    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map(d => d.date),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: labelColor }
      },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [{
        name: '消息数',
        type: 'line',
        data: data.map(d => d.message_count),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: chartColors[0] },
            { offset: 1, color: chartColors[1] }
          ])
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(chartColors[0], 0.28) },
            { offset: 1, color: withAlpha(chartColors[1], 0.06) }
          ])
        }
      }]
    })
    charts.push(chart)
  }

  if (performElementRef.value) {
    const chart = echarts.init(performElementRef.value)
    const totalData = data.reduce((acc, d) => {
      acc.text += d.text_count || 0
      acc.image += d.image_count || 0
      acc.audio += d.audio_count || 0
      acc.video += d.video_count || 0
      return acc
    }, { text: 0, image: 0, audio: 0, video: 0 })

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['文字', '图片', '音频', '视频'],
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: gridColor } } },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [{
        name: '使用量',
        type: 'bar',
        barWidth: '40%',
        data: [totalData.text, totalData.image, totalData.audio, totalData.video],
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors[2] },
            { offset: 1, color: chartColors[0] }
          ])
        }
      }]
    })
    charts.push(chart)
  }

  if (activeHoursRef.value) {
    const chart = echarts.init(activeHoursRef.value)
    const hourData = new Array(24).fill(0)
    data.forEach(d => {
      if (d.hour !== null && d.hour !== undefined) {
        hourData[d.hour] += d.message_count || 0
      }
    })

    chart.setOption({
      ...commonOption,
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, i) => `${i}`),
        axisLine: { lineStyle: { color: axisColor } },
        axisLabel: { color: labelColor }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: gridColor } } },
      grid: { top: 20, right: 20, bottom: 20, left: 40, containLabel: true },
      series: [{
        name: '消息数',
        type: 'bar',
        barWidth: '60%',
        data: hourData,
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: chartColors[3] },
            { offset: 1, color: chartColors[4] }
          ])
        }
      }]
    })
    charts.push(chart)
  }
}

function handleSearch() {
  currentPage.value = 1
  debouncedLoadMessages()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  void loadMessages()
}

function handleDateRangeChange(value: [number, number] | null) {
  dateRange.value = value
  void loadStatistics()
}

function handleClearHistory() {
  dialog.error({
    title: '清空历史记录',
    content: '确定要清空所有历史记录吗？此操作不可恢复！',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await window.electron.history.clearHistory()
        if (result.success) {
          message.success('历史记录已清空')
          await loadMessages()
          await loadStatistics()
        }
      } catch (error: any) {
        message.error(`清空失败: ${error.message}`)
      }
    }
  })
}

async function handleRefreshHistory() {
  await syncHistoryResourceConfig()
  await loadMessages()
  await loadStatistics()
  message.success('已刷新')
}

function formatTimestamp(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss')
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  const cached = getLruCacheEntry(markdownRenderCache, text)
  if (cached !== undefined) return cached

  const rendered = renderMarkdownFromShared(text).trim()
  return setLruCacheEntry(markdownRenderCache, text, rendered, 500)
}

function parseContent(content: string): any[] {
  return parseHistoryContent(content, messageContentCache, 1000)
}

function getMessageAuthorLabel(msg: any): string {
  if (msg.direction === 'outgoing') return msg.user_name || '我'
  if (msg.user_id === 'server' || msg.user_id === 'bot') return 'AstrBot'
  return msg.user_name || msg.user_id || '未知来源'
}

function resolveMessageImageSource(item: any): string | null {
  return resolveHistoryImageSource(item, {
    resourceBaseUrl: historyResourceBaseUrl.value,
    resourcePath: historyResourcePath.value,
    resourceToken: historyResourceToken.value,
  })
}

function resolveMessageAudioSource(item: any): string | null {
  return resolveHistoryMediaSource(item, {
    resourceBaseUrl: historyResourceBaseUrl.value,
    resourcePath: historyResourcePath.value,
    resourceToken: historyResourceToken.value,
  })
}

function resolveMessageVideoSource(item: any): string | null {
  return resolveHistoryMediaSource(item, {
    resourceBaseUrl: historyResourceBaseUrl.value,
    resourcePath: historyResourcePath.value,
    resourceToken: historyResourceToken.value,
  })
}

function resolveMessageFileSource(item: any): string | null {
  return resolveHistoryMediaSource(item, {
    resourceBaseUrl: historyResourceBaseUrl.value,
    resourcePath: historyResourcePath.value,
    resourceToken: historyResourceToken.value,
  })
}

function getHistoryFileSource(item: any): string | null {
  if (typeof item?.src === 'string' && item.src.trim()) return item.src.trim()
  return resolveMessageFileSource(item)
}

function getHistoryFileName(item: any): string {
  if (typeof item?.name === 'string' && item.name.trim()) return item.name.trim()
  if (typeof item?.label === 'string' && item.label.trim()) return item.label.trim()
  return 'file.bin'
}

async function openHistoryFile(item: any) {
  const source = getHistoryFileSource(item)
  if (!source) {
    message.warning('文件资源不可用')
    return
  }
  try {
    const result = await window.electron.window.openResource(source, getHistoryFileName(item))
    if (!result.success) throw new Error(result.error || '打开文件失败')
  } catch (error: any) {
    message.error(`打开文件失败: ${error.message || error}`)
  }
}

async function downloadHistoryFile(item: any) {
  const source = getHistoryFileSource(item)
  if (!source) {
    message.warning('文件资源不可用')
    return
  }
  try {
    const result = await window.electron.window.saveResource(source, getHistoryFileName(item))
    if (result.canceled) return
    if (!result.success) throw new Error(result.error || '下载文件失败')
    message.success('文件已开始保存')
  } catch (error: any) {
    message.error(`下载文件失败: ${error.message || error}`)
  }
}

async function saveAdvancedSettings() {
  advancedSettings.value = persistAdvancedSettings(advancedSettings.value)
  await applyLogLevelSetting(advancedSettings.value.logLevel)
  message.success('高级设置已保存')
}

/** 即时保存 advancedSettings，切换后立即生效 */
async function applyAdvancedSettingChange() {
  advancedSettings.value = persistAdvancedSettings(advancedSettings.value)
  await applyLogLevelSetting(advancedSettings.value.logLevel)
}

/** 处理主题色跟随开关变化，开启时立即重新提取主题色 */
async function handleThemeFollowChange(_value: boolean) {
  await applyAdvancedSettingChange()
  // storage 事件通知主窗口，主窗口的 handleStorageChange 会处理提取
}

// 窗口监听配置相关方法
async function loadWatcherConfig() {
  try {
    const config = await window.electron.window.getWatcherConfig()
    watcherConfig.value = config
    
    // 更新 textarea 显示
    specificAppsInput.value = config.aiResponse.specificApps.join('\n')
    ignoreProcessNamesInput.value = config.ignore.processNames.join('\n')
    ignoreTitleKeywordsInput.value = config.ignore.titleKeywords.join('\n')
  } catch (error) {
    console.error('[设置] 加载窗口监听配置失败:', error)
  }
}

function createWatcherConfigPayload(): WindowWatcherConfig {
  return {
    enabled: watcherConfig.value.enabled,
    appLaunchEnabled: watcherConfig.value.appLaunchEnabled,
    throttle: {
      globalInterval: watcherConfig.value.throttle.globalInterval,
      perWindowInterval: watcherConfig.value.throttle.perWindowInterval,
      minInterval: watcherConfig.value.throttle.minInterval,
    },
    events: {
      focus: watcherConfig.value.events.focus,
      blur: watcherConfig.value.events.blur,
      create: watcherConfig.value.events.create,
      destroy: watcherConfig.value.events.destroy,
      fullscreen: watcherConfig.value.events.fullscreen,
      windowed: watcherConfig.value.events.windowed,
      resize: watcherConfig.value.events.resize,
      move: watcherConfig.value.events.move,
      minimize: watcherConfig.value.events.minimize,
      maximize: watcherConfig.value.events.maximize,
      restore: watcherConfig.value.events.restore,
    },
    ignore: {
      processNames: [...watcherConfig.value.ignore.processNames],
      titleKeywords: [...watcherConfig.value.ignore.titleKeywords],
    },
    aiResponse: {
      mode: watcherConfig.value.aiResponse.mode,
      specificApps: [...watcherConfig.value.aiResponse.specificApps],
    },
  }
}

async function saveWatcherConfig() {
  try {
    await window.electron.window.updateWatcherConfig(createWatcherConfigPayload())
    message.success('窗口监听配置已保存')
  } catch (error: any) {
    message.error(`保存失败: ${error.message}`)
  }
}

async function resetWatcherConfig() {
  try {
    const result = await window.electron.window.resetWatcherConfig()
    watcherConfig.value = result.config
    
    // 更新 textarea 显示
    specificAppsInput.value = result.config.aiResponse.specificApps.join('\n')
    ignoreProcessNamesInput.value = result.config.ignore.processNames.join('\n')
    ignoreTitleKeywordsInput.value = result.config.ignore.titleKeywords.join('\n')
    
    message.success('窗口监听配置已重置')
  } catch (error: any) {
    message.error(`重置失败: ${error.message}`)
  }
}

function updateSpecificApps(value: string) {
  specificAppsInput.value = value
  watcherConfig.value.aiResponse.specificApps = value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s)
  saveWatcherConfig()
}

function updateIgnoreProcessNames(value: string) {
  ignoreProcessNamesInput.value = value
  // 过滤掉内置规则，只保存用户自定义的
  const builtinProcessNames = [
    'dwm.exe', 'csrss.exe', 'explorer.exe', 'SearchUI.exe',
    'ShellExperienceHost.exe', 'StartMenuExperienceHost.exe',
    'TextInputHost.exe', 'SecurityHealthSystray.exe',
  ]
  watcherConfig.value.ignore.processNames = value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !builtinProcessNames.includes(s))
  saveWatcherConfig()
}

function updateIgnoreTitleKeywords(value: string) {
  ignoreTitleKeywordsInput.value = value
  // 过滤掉内置规则，只保存用户自定义的
  const builtinTitleKeywords = [
    'Program Manager', '锁屏', 'Lock Screen', 'LockApp',
    'Windows Shell Experience Host', 'Windows Default Lock Screen',
    'Windows 输入体验', 'Task Switching', 'Task View',
  ]
  watcherConfig.value.ignore.titleKeywords = value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !builtinTitleKeywords.some(k => s.toLowerCase().includes(k.toLowerCase())))
  saveWatcherConfig()
}

function getModelPreviewStyle(modelPath: string) {
  return modelPath === currentModelPath.value
    ? themeSwatchStyle.value
    : inactiveModelSwatchStyle.value
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
  await applyAdvancedSettingChange()
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
      const preservedEntries = SETTINGS_PRESERVED_LOCAL_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)] as const)

      localStorage.clear()

      for (const [key, value] of preservedEntries) {
        if (value !== null) {
          localStorage.setItem(key, value)
        }
      }

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
    onPositiveClick: async () => {
      try {
        localStorage.clear()

        const connectionDefaults = buildDefaultConnectionSettingsEditable()
        serverUrl.value = connectionDefaults.serverUrl
        token.value = connectionDefaults.token
        resourceServerUrl.value = connectionDefaults.customResourceBaseUrl
        resourceServerPath.value = connectionDefaults.customResourcePath
        resourceAccessToken.value = connectionDefaults.customResourceToken

        const connectionResetResult = await connectionStore.savePersistedSettings()
        if (!connectionResetResult.success) {
          throw new Error(`连接配置重置失败: ${connectionResetResult.error}`)
        }
        await connectionStore.checkConnection()

        advancedSettings.value = normalizeAdvancedSettings(DEFAULT_ADVANCED_SETTINGS)
        persistAdvancedSettings(advancedSettings.value)
        void applyLogLevelSetting(advancedSettings.value.logLevel)

        applyDesktopFeatureSettingsState(
          await window.electron.desktopBehavior.updatePreferences(DEFAULT_DESKTOP_FEATURE_SETTINGS),
        )

        const nextUpdaterSettings = await window.electron.update.updateSettings(DEFAULT_UPDATER_SETTINGS)
        updaterSettings.value = {
          autoUpdateEnabled: Boolean(nextUpdaterSettings.autoUpdateEnabled),
        }

        const nextScreenshotSettings = await window.electron.window.updateScreenshotSettings(DEFAULT_SCREENSHOT_SETTINGS)
        screenshotSettings.value = {
          defaultTarget: nextScreenshotSettings.defaultTarget === 'desktop' ? 'desktop' : 'active',
          quality: Number(nextScreenshotSettings.quality) || DEFAULT_SCREENSHOT_SETTINGS.quality,
          maxWidth: Number(nextScreenshotSettings.maxWidth) || DEFAULT_SCREENSHOT_SETTINGS.maxWidth,
        }

        const watcherResetResult = await window.electron.window.resetWatcherConfig()
        watcherConfig.value = watcherResetResult.config
        specificAppsInput.value = watcherResetResult.config.aiResponse.specificApps.join('\n')
        ignoreProcessNamesInput.value = watcherResetResult.config.ignore.processNames.join('\n')
        ignoreTitleKeywordsInput.value = watcherResetResult.config.ignore.titleKeywords.join('\n')

        await window.electron.shortcut.unregister()
        await checkShortcutRegistration()

        message.success('设置已重置')
      } catch (error: any) {
        message.error(`重置失败: ${error?.message || String(error)}`)
      }
    },
  })
}

async function handleMinimizeWindow() {
  const result = await window.electron.window.minimizeCurrent()
  if (!result.success) {
    message.error(result.error || '最小化失败')
  }
}

async function handleToggleWindowMaximize() {
  const result = await window.electron.window.toggleMaximizeCurrent()
  if (!result.success) {
    message.error(result.error || '切换窗口状态失败')
    return
  }
  isWindowMaximized.value = Boolean(result.maximized)
}

async function handleCloseWindow() {
  const result = await window.electron.window.closeCurrent()
  if (!result.success) {
    message.error(result.error || '关闭窗口失败')
  }
}

function handleTitleBarDoubleClick() {
  void handleToggleWindowMaximize()
}

function handleOpenLink(url: string) {
  void window.electron.window.openExternal(url)
}
</script>

<style scoped lang="scss">
.settings-window {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(var(--color-accent-rgb), 0.14), transparent 18%),
    linear-gradient(180deg, rgba(38, 30, 25, 0.98), var(--settings-bg-base) 38%, rgba(17, 14, 13, 1));
}

.settings-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: var(--desktop-titlebar-height);
  padding: 0 8px 0 14px;
  background: rgba(23, 18, 16, 0.96);
  border-bottom: 1px solid var(--desktop-panel-border);
}

.settings-titlebar__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.settings-titlebar__view {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.settings-titlebar__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.settings-titlebar__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 245, 236, 0.78);
  transition: background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }

  &:focus-visible {
    outline: 1px solid rgba(var(--color-accent-rgb), 0.42);
    outline-offset: 1px;
  }

  &--close:hover {
    background: rgba(198, 78, 65, 0.88);
    color: #fff5ef;
  }
}

// 三栏布局
.settings-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 56px minmax(180px, 220px) 1fr;
}

// 左栏：一级导航（图标栏）
.settings-primary-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 0;
  background: rgba(20, 16, 14, 0.95);
  border-right: 1px solid var(--desktop-panel-border);
}

.settings-primary-nav__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: transparent;
  color: var(--color-text-tertiary);
  transition: all var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-secondary);
  }

  &--active {
    background: rgba(var(--color-accent-rgb), 0.14);
    color: var(--color-accent);
  }
}

// 中栏：二级导航
.settings-secondary-nav {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgba(24, 20, 18, 0.9);
  border-right: 1px solid var(--desktop-panel-border);
}

.settings-secondary-nav__header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--desktop-panel-border);

  strong {
    font-size: 14px;
    letter-spacing: -0.02em;
  }
}

.settings-secondary-nav__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-secondary-nav__item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-align: left;
  transition: all var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
  }

  &--active {
    background: rgba(var(--color-accent-rgb), 0.12);
    color: var(--color-text-primary);
  }
}

// 右栏：内容区域
.settings-content {
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  padding: 20px 24px;
  background:
    linear-gradient(180deg, rgba(28, 22, 19, 0.5), rgba(17, 14, 13, 0.7));
}

.settings-content__viewport {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// 页面切换动画 - 温和的滑动效果
.page-fade-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.page-fade-leave-active {
  transition: opacity 0.2s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-fade-leave-to {
  opacity: 0;
}

// 中栏标题动画
.slide-fade-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.slide-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

// 中栏列表动画
.list-fade-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.list-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.list-fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.list-fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

// 设置区块
.settings-section {
  padding: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 28%), var(--desktop-panel-bg);
  border: 1px solid var(--desktop-panel-border);
  border-radius: var(--desktop-radius-panel);
  box-shadow: var(--desktop-shadow);
}

.settings-section--fill {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.settings-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;

  h2 {
    margin: 0;
    font-size: 16px;
    letter-spacing: -0.03em;
  }
}

.settings-section__desc {
  margin: 0 0 16px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.settings-section__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.settings-section__note {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

// 键值列表
.settings-kv-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--desktop-divider);
  border-radius: var(--desktop-radius-panel);
  overflow: hidden;
}

.settings-kv-list__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.06);

  & + & {
    border-top: 1px solid var(--desktop-divider);
  }

  span {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  strong {
    font-size: 13px;
    max-width: 60%;
    text-align: right;
    word-break: break-word;
  }
}

// 当前模型信息
.current-model-info {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.current-model-info__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  color: var(--theme-accent-contrast);
  font-size: 24px;
  font-weight: 700;
  flex-shrink: 0;
}

.current-model-info__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  strong {
    font-size: 16px;
    line-height: 1.2;
  }
}

.current-model-info__color {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.settings-inline-path {
  display: block;
  padding: 8px 10px;
  border-radius: var(--desktop-radius-control);
  background: rgba(0, 0, 0, 0.14);
  border: 1px solid var(--desktop-panel-border);
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}

// 模型网格
.model-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.model-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: var(--desktop-radius-panel);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 34%), rgba(255, 255, 255, 0.02);
  border: 1px solid var(--desktop-panel-border);
  transition: all var(--duration-fast) var(--ease-out);

  &:hover {
    border-color: rgba(var(--color-accent-rgb), 0.22);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
  }

  &--active {
    border-color: rgba(var(--color-accent-rgb), 0.32);
    background: linear-gradient(180deg, rgba(var(--color-accent-rgb), 0.08), transparent 30%), rgba(255, 255, 255, 0.024);
  }
}

.model-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.model-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  color: var(--theme-accent-contrast);
  font-size: 18px;
  font-weight: 700;
}

.model-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.14);
  border: 1px solid rgba(var(--color-accent-rgb), 0.28);
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: 600;
}

.model-card__body {
  min-width: 0;

  strong {
    display: block;
    margin-bottom: 4px;
    font-size: 14px;
  }

  code {
    display: block;
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
    font-size: 11px;
    word-break: break-all;
  }
}

.model-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

// 快捷键行
.shortcut-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.shortcut-row :deep(.n-input) {
  flex: 1 1 200px;
}

// 窗口监听配置样式
.specific-apps-config {
  margin-top: 16px;
}

// 链接栈
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

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--desktop-panel-border-strong);
  }
}

// 历史记录工具栏
.history-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.history-toolbar-actions :deep(.n-input) {
  width: 160px;
}

// 消息列表 - 聊天式左右布局
.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 300px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding: 8px;
}

.message-item {
  display: flex;
  gap: 10px;
  max-width: 85%;
}

.message-item--outgoing {
  flex-direction: row-reverse;
  margin-left: auto;
}

.message-item--incoming {
  margin-right: auto;
}

.message-avatar {
  flex-shrink: 0;
}

.message-avatar__icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--desktop-panel-border);
  color: var(--color-text-secondary);
}

.message-item--outgoing .message-avatar__icon {
  background: rgba(var(--color-accent-rgb), 0.12);
  border-color: rgba(var(--color-accent-rgb), 0.2);
  color: var(--color-accent);
}

.message-bubble {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--desktop-panel-border);
}

.message-item--outgoing .message-bubble {
  background: rgba(var(--color-accent-rgb), 0.08);
  border-color: rgba(var(--color-accent-rgb), 0.15);
  border-bottom-right-radius: 4px;
}

.message-item--incoming .message-bubble {
  border-bottom-left-radius: 4px;
}

.message-bubble__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.message-bubble__name {
  font-size: 12px;
  font-weight: 600;
}

.message-bubble__time {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
}

.message-bubble__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.content-item {
  margin-bottom: 4px;
}

.content-item:last-child {
  margin-bottom: 0;
}

.text-content {
  line-height: 1.5;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;

  :deep(p) {
    margin: 2px 0;
  }

  :deep(code) {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1px 4px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.9em;
    color: #e0e0e0;
  }

  :deep(pre) {
    background: rgba(0, 0, 0, 0.3);
    padding: 10px 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 6px 0;
    border: 1px solid rgba(255, 255, 255, 0.08);

    code {
      background: none;
      border: none;
      padding: 0;
      color: #d4d4d4;
    }
  }
}

.image-content {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  display: inline-block;
  line-height: 0;

  :deep(.n-image) {
    display: block;
  }

  :deep(img) {
    display: block;
    max-width: 100%;
    height: auto;
    transition: transform 0.2s ease;
  }

  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

    :deep(img) {
      transform: scale(1.02);
    }
  }
}

// 语音条样式 - 微信/QQ 风格
.voice-bubble {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  min-width: 100px;
  max-width: 200px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &:active {
    background: rgba(255, 255, 255, 0.14);
  }
}

.message-item--outgoing .voice-bubble {
  flex-direction: row-reverse;
  background: rgba(var(--color-accent-rgb), 0.12);

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.18);
  }
}

.voice-bubble__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.message-item--outgoing .voice-bubble__icon {
  color: var(--color-accent);
}

.voice-bubble__wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 20px;

  span {
    display: block;
    width: 3px;
    background: var(--color-text-tertiary);
    border-radius: 2px;
    animation: none;

    &:nth-child(1) { height: 6px; }
    &:nth-child(2) { height: 12px; }
    &:nth-child(3) { height: 18px; }
    &:nth-child(4) { height: 12px; }
    &:nth-child(5) { height: 6px; }
  }
}

.message-item--outgoing .voice-bubble__wave span {
  background: rgba(var(--color-accent-rgb), 0.6);
}

.voice-bubble:hover .voice-bubble__wave span,
.voice-bubble.playing .voice-bubble__wave span {
  animation: voiceWave 0.6s ease-in-out infinite alternate;

  &:nth-child(1) { animation-delay: 0s; }
  &:nth-child(2) { animation-delay: 0.1s; }
  &:nth-child(3) { animation-delay: 0.2s; }
  &:nth-child(4) { animation-delay: 0.3s; }
  &:nth-child(5) { animation-delay: 0.4s; }
}

@keyframes voiceWave {
  0% { height: 4px; }
  100% { height: 18px; }
}

.voice-bubble__duration {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  white-space: nowrap;
}

.voice-bubble audio {
  display: none;
}

// 视频和文件内容
.video-content,
.file-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.video-player {
  width: 100%;
  max-height: 200px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
}

.media-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.file-name {
  word-break: break-all;
}

.file-actions {
  display: flex;
  gap: 6px;
}

.file-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--color-text-secondary);
  transition: all var(--duration-fast) var(--ease-out);

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.12);
    border-color: rgba(var(--color-accent-rgb), 0.2);
    color: var(--color-text-primary);
  }
}

.performance-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.performance-elements {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.performance-elements :deep(.n-tag) {
  margin: 0;
  border-radius: 999px;
  font-size: 11px;
}

.history-pagination {
  margin-top: 16px;
}

.settings-toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.settings-toggle-item__main {
  flex: 1;
  min-width: 0;
}

.settings-toggle-item__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--desktop-text-primary);
}

.settings-toggle-item__desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--desktop-text-secondary);
}

// 图表网格
.chart-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, 1fr);
}

.chart-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--desktop-panel-border);
  border-radius: 10px;

  h3 {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  &--wide {
    grid-column: 1 / -1;
  }
}

.chart-container {
  width: 100%;
  height: 180px;
}

// 响应式
@media (max-width: 960px) {
  .settings-workspace {
    grid-template-columns: 48px 1fr;
  }

  .settings-secondary-nav {
    display: none;
  }
}

@media (max-width: 640px) {
  .settings-workspace {
    grid-template-columns: 1fr;
  }

  .settings-primary-nav {
    flex-direction: row;
    justify-content: center;
    border-right: none;
    border-bottom: 1px solid var(--desktop-panel-border);
    padding: 8px 12px;
  }

  .settings-content {
    padding: 16px;
  }
}
</style>
