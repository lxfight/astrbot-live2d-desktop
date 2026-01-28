<template>
  <div class="idle-motion-container">
    <!-- 顶部设置栏 -->
    <div class="settings-header">
      <div class="header-left">
        <h3 class="page-title">待机动作配置 (Idle)</h3>
        <p class="page-subtitle">配置模型空闲时自动播放的动作与表情</p>
      </div>
      <div class="header-right">
        <div class="setting-controls">
          <label class="toggle-control" title="是否启用随机播放">
            <input type="checkbox" v-model="enableRandomIdle">
            <span class="toggle-label">随机播放</span>
          </label>
          
          <div class="number-control" title="触发闲置动作前的等待时间">
            <span class="control-label">检测(秒)</span>
            <input 
              type="number" 
              v-model.number="idleDetectionTime"
              min="5" 
              max="300"
              class="control-input"
            >
          </div>

          <div class="number-control" title="两个闲置动作之间的间隔">
            <span class="control-label">间隔(秒)</span>
            <input 
              type="number" 
              v-model.number="idleMotionInterval"
              min="3" 
              max="60"
              class="control-input"
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧：类型切换与可用资源 -->
      <div class="panel source-panel">
        <div class="panel-header">
          <div class="tabs">
            <button 
              class="tab-btn" 
              :class="{ active: activeTab === 'motions' }"
              @click="activeTab = 'motions'"
            >
              动作库
            </button>
            <button 
              class="tab-btn" 
              :class="{ active: activeTab === 'expressions' }"
              @click="activeTab = 'expressions'"
            >
              表情库
            </button>
          </div>
          <div class="search-box">
            <AppIcon name="search" :size="14" class="search-icon" />
            <input v-model="searchQuery" placeholder="搜索..." />
          </div>
        </div>

        <div class="panel-body scroll-container">
          <div class="assets-list">
            <div 
              v-for="item in filteredAssets" 
              :key="getItemKey(item)"
              class="asset-item"
              @dblclick="addItem(item)"
            >
              <div class="asset-icon">
                {{ activeTab === 'motions' ? '🎭' : '😊' }}
              </div>
              <div class="asset-info">
                <div class="asset-name" :title="getItemName(item)">{{ getItemName(item) }}</div>
                <div class="asset-meta">{{ getItemMeta(item) }}</div>
              </div>
              <button class="action-btn add-btn" @click="addItem(item)">
                <AppIcon name="plus" :size="14" />
              </button>
            </div>
            <div v-if="filteredAssets.length === 0" class="empty-hint">
              没有找到相关{{ activeTab === 'motions' ? '动作' : '表情' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 中间：操作提示/分隔 -->
      <div class="divider-column">
        <div class="arrow-icon">
          <AppIcon name="arrow-right" :size="20" />
        </div>
      </div>

      <!-- 右侧：已配置的闲置列表 -->
      <div class="panel config-panel">
        <div class="panel-header">
          <h4 class="panel-title">
            已启用 ({{ activeConfigList.length }})
            <span class="badge">{{ activeTab === 'motions' ? '动作' : '表情' }}</span>
          </h4>
          <div class="panel-actions">
            <button class="icon-btn" @click="shuffleCurrentList" title="随机填充">
              <AppIcon name="shuffle" :size="16" />
            </button>
            <button class="icon-btn danger" @click="clearCurrentList" title="清空列表">
              <AppIcon name="trash" :size="16" />
            </button>
          </div>
        </div>

        <div class="panel-body scroll-container">
          <div class="config-list">
            <div 
              v-for="(item, index) in activeConfigList"
              :key="item.motionId"
              class="config-item"
            >
              <div class="config-info">
                <span class="config-name">{{ item.motionName }}</span>
                <span class="config-meta">{{ item.groupId }} #{{ item.index }}</span>
              </div>
              <div class="config-actions">
                <button 
                  class="action-btn" 
                  :disabled="index === 0"
                  @click="moveItem(index, -1)"
                >
                  <AppIcon name="arrow-up" :size="14" />
                </button>
                <button 
                  class="action-btn" 
                  :disabled="index === activeConfigList.length - 1"
                  @click="moveItem(index, 1)"
                >
                  <AppIcon name="arrow-down" :size="14" />
                </button>
                <button 
                  class="action-btn remove-btn" 
                  @click="removeItem(item.motionId)"
                >
                  <AppIcon name="x" :size="14" />
                </button>
              </div>
            </div>
            
            <div v-if="activeConfigList.length === 0" class="empty-state">
              <AppIcon name="inbox" :size="32" class="empty-icon" />
              <p>暂无配置</p>
              <span class="hint">从左侧选择添加，或点击随机按钮</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { motionService, idleMotions, idleExpressions } from '../../services/motionManagement'
import { MOTION_TYPES } from '../../types/motionManagement'
import AppIcon from '../icons/AppIcon.vue'

// 状态
const activeTab = ref<'motions' | 'expressions'>('motions')
const searchQuery = ref('')

// 设置 (直接绑定 localStorage，实际项目中建议移至 store)
const enableRandomIdle = ref(localStorage.getItem('idle_random_enabled') !== 'false')
const idleDetectionTime = ref(parseInt(localStorage.getItem('idle_detection_time') || '30'))
const idleMotionInterval = ref(parseInt(localStorage.getItem('idle_motion_interval') || '10'))

// 源数据
const allMotions = computed(() => motionService.getAllMotions())
const allExpressions = computed(() => motionService.getAllExpressions())

// 过滤后的源数据
const filteredAssets = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (activeTab.value === 'motions') {
    return allMotions.value.filter(m => 
      m.name.toLowerCase().includes(query) || m.group.toLowerCase().includes(query)
    )
  } else {
    return allExpressions.value.filter(e => 
      e.name.toLowerCase().includes(query) || e.id.toLowerCase().includes(query)
    )
  }
})

// 当前激活的配置列表
const activeConfigList = computed(() => {
  return activeTab.value === 'motions' ? idleMotions.value : idleExpressions.value
})

// 辅助方法
const getItemKey = (item: any) => {
  return activeTab.value === 'motions' 
    ? `m-${item.group}-${item.index}` 
    : `e-${item.id}`
}

const getItemName = (item: any) => item.name
const getItemMeta = (item: any) => {
  return activeTab.value === 'motions' 
    ? `${item.group}` 
    : 'Expression'
}

// 操作方法
const addItem = (item: any) => {
  if (activeTab.value === 'motions') {
    const assignment = {
      motionId: `${item.group}:${item.index}`,
      motionName: item.name,
      groupId: item.group,
      index: item.index,
      type: MOTION_TYPES.find(t => t.id === 'idle')
    }
    // 检查重复
    if (!idleMotions.value.some(m => m.motionId === assignment.motionId)) {
      const newList = [...idleMotions.value, assignment]
      motionService.setIdleMotions(newList)
    }
  } else {
    const assignment = {
      motionId: item.id,
      motionName: item.name,
      groupId: 'expression',
      index: 0,
      type: MOTION_TYPES.find(t => t.id === 'idle')
    }
    if (!idleExpressions.value.some(e => e.motionId === assignment.motionId)) {
      const newList = [...idleExpressions.value, assignment]
      motionService.setIdleExpressions(newList)
    }
  }
}

const removeItem = (id: string) => {
  if (activeTab.value === 'motions') {
    const newList = idleMotions.value.filter(m => m.motionId !== id)
    motionService.setIdleMotions(newList)
  } else {
    const newList = idleExpressions.value.filter(e => e.motionId !== id)
    motionService.setIdleExpressions(newList)
  }
}

const moveItem = (index: number, direction: number) => {
  const list = activeTab.value === 'motions' ? [...idleMotions.value] : [...idleExpressions.value]
  const newIndex = index + direction
  
  if (newIndex < 0 || newIndex >= list.length) return
  
  const temp = list[index]
  list[index] = list[newIndex]
  list[newIndex] = temp
  
  if (activeTab.value === 'motions') {
    motionService.setIdleMotions(list)
  } else {
    motionService.setIdleExpressions(list)
  }
}

const clearCurrentList = () => {
  if (!confirm('确定要清空当前列表吗？')) return
  if (activeTab.value === 'motions') {
    motionService.setIdleMotions([])
  } else {
    motionService.setIdleExpressions([])
  }
}

const shuffleCurrentList = () => {
  const source = activeTab.value === 'motions' ? allMotions.value : allExpressions.value
  const count = Math.min(5, source.length)
  if (count === 0) return

  // 简单的随机选取
  const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, count)
  
  // 清空并添加
  if (activeTab.value === 'motions') {
    motionService.setIdleMotions([]) // Reset first
    shuffled.forEach(m => addItem(m))
  } else {
    motionService.setIdleExpressions([])
    shuffled.forEach(e => addItem(e))
  }
}

// 持久化设置
const saveSettings = () => {
  localStorage.setItem('idle_random_enabled', enableRandomIdle.value.toString())
  localStorage.setItem('idle_detection_time', idleDetectionTime.value.toString())
  localStorage.setItem('idle_motion_interval', idleMotionInterval.value.toString())
}

watch([enableRandomIdle, idleDetectionTime, idleMotionInterval], saveSettings)
</script>

<style scoped>
.idle-motion-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  color: var(--text-primary);
}

/* Header & Settings */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.page-title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.setting-controls {
  display: flex;
  gap: 20px;
  align-items: center;
}

.toggle-control {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-label {
  font-size: 13px;
}

.number-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.control-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 13px;
  text-align: center;
}

/* Main Content Layout */
.main-content {
  flex: 1;
  display: flex;
  min-height: 0; /* Important for scroll */
  gap: 16px;
}

.panel {
  display: flex;
  flex-direction: column;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.source-panel {
  flex: 1;
}

.config-panel {
  flex: 1;
}

.divider-column {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

/* Panel Header */
.panel-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 50px;
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--primary-color);
  color: var(--primary-fg);
  border-radius: 4px;
  font-weight: normal;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-app);
  padding: 3px;
  border-radius: 8px;
}

.tab-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--surface-color);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  font-weight: 500;
}

/* Search */
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-app);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  width: 140px;
}

.search-box input {
  border: none;
  background: transparent;
  width: 100%;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
}

.search-icon {
  color: var(--text-secondary);
}

/* Panel Body */
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* List Items */
.asset-item, .config-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: default;
  transition: background 0.2s;
  border: 1px solid transparent;
}

.asset-item:hover {
  background: var(--hover-bg);
  border-color: var(--border-color);
}

.config-item {
  background: var(--bg-app);
  border-color: var(--border-color);
}

.asset-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.asset-info, .config-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.asset-name, .config-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-meta, .config-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

/* Buttons */
.action-btn, .icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.action-btn {
  width: 24px;
  height: 24px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
}

.action-btn:hover, .icon-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.add-btn:hover {
  background: var(--primary-color);
  color: white;
}

.remove-btn:hover, .icon-btn.danger:hover {
  background: var(--danger-color);
  color: white;
  border-color: var(--danger-color);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Empty States */
.empty-hint, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}

.empty-state {
  height: 100%;
}

.empty-icon {
  margin-bottom: 8px;
  opacity: 0.5;
}

.hint {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.7;
}
</style>