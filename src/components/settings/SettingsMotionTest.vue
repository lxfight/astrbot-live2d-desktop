<template>
  <div class="motion-test-page">
    <div class="page-header">
      <h2>动作类型测试</h2>
      <div class="test-actions">
        <button 
          class="btn btn-primary"
          @click="runFullTest"
          :disabled="testing"
        >
          <AppIcon name="play" :size="16" :class="{ spin: testing }" />
          {{ testing ? '测试中...' : '完整测试' }}
        </button>
        <button 
          class="btn btn-outline"
          @click="clearResults"
        >
          <AppIcon name="refresh-cw" :size="16" />
          清空结果
        </button>
      </div>
    </div>

    <div class="test-grid">
      <!-- 动作类型测试 -->
      <div class="test-section">
        <div class="section-header">
          <h3>🎭 动作类型系统</h3>
          <span class="status-badge" :class="motionTypesStatus">
            {{ getStatusText(motionTypesStatus) }}
          </span>
        </div>
        
        <div class="test-content">
          <div class="info-item">
            <span class="label">动作类型数量:</span>
            <span class="value">{{ MOTION_TYPES.length }} 个</span>
          </div>
          
          <div class="test-input">
            <input 
              v-model="testText"
              @keyup.enter="testMotionMatching"
              placeholder="输入文本测试动作匹配..."
              class="test-input-field"
            />
            <button 
              class="btn btn-sm btn-primary"
              @click="testMotionMatching"
            >
              测试匹配
            </button>
          </div>
          
          <div v-if="matchResult" class="test-result">
            <div class="result-header">
              <span class="result-type">{{ matchResult.type?.icon }} {{ matchResult.type?.name }}</span>
              <span class="result-id">({{ matchResult.typeId }})</span>
            </div>
            <div class="result-details">
              <p>{{ matchResult.type?.description }}</p>
              <small>匹配关键词: {{ matchResult.matchedKeywords?.join(', ') || '无' }}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- 动作管理测试 -->
      <div class="test-section">
        <div class="section-header">
          <h3>📋 动作管理服务</h3>
          <span class="status-badge" :class="motionServiceStatus">
            {{ getStatusText(motionServiceStatus) }}
          </span>
        </div>
        
        <div class="test-content">
          <div class="info-item">
            <span class="label">当前模型动作:</span>
            <span class="value">{{ currentModelMotions.length }} 个</span>
          </div>
          
          <div class="info-item">
            <span class="label">当前模型表情:</span>
            <span class="value">{{ currentModelExpressions.length }} 个</span>
          </div>
          
          <div class="info-item">
            <span class="label">已分配动作:</span>
            <span class="value">{{ totalAssignedMotions }} 个</span>
          </div>
          
          <button 
            class="btn btn-sm btn-outline"
            @click="testMotionService"
          >
            测试随机选择
          </button>
          
          <div v-if="randomTestResult" class="test-result">
            <div class="result-header">
              <span>随机选择结果:</span>
            </div>
            <div class="result-details">
              <p v-if="randomTestResult.motion">
                动作: {{ randomTestResult.motion.motionName }}
              </p>
              <p v-if="randomTestResult.expression">
                表情: {{ randomTestResult.expression.motionName }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 表演序列测试 -->
      <div class="test-section">
        <div class="section-header">
          <h3>🎬 表演序列处理</h3>
          <span class="status-badge" :class="performTestStatus">
            {{ getStatusText(performTestStatus) }}
          </span>
        </div>
        
        <div class="test-content">
          <div class="test-input">
            <textarea 
              v-model="testMessage"
              placeholder="输入消息内容测试表演序列生成..."
              class="test-textarea"
              rows="3"
            ></textarea>
            <button 
              class="btn btn-sm btn-primary"
              @click="testPerformSequence"
            >
              生成序列
            </button>
          </div>
          
          <div v-if="performSequence" class="test-result">
            <div class="result-header">
              <span>生成序列 ({{ performSequence.length }} 项):</span>
            </div>
            <div class="sequence-list">
              <div 
                v-for="(item, index) in performSequence"
                :key="index"
                class="sequence-item"
                :class="{ 'with-motion-type': !!item.motionType }"
              >
                <div class="item-header">
                  <span class="item-type">{{ item.type }}</span>
                  <span v-if="item.motionType" class="motion-type-badge">
                    {{ getMotionTypeIcon(item.motionType) }} {{ item.motionType }}
                  </span>
                </div>
                <div class="item-details">
                  <small v-if="item.type === 'text'">{{ item.content?.substring(0, 50) }}...</small>
                  <small v-else-if="item.type === 'motion'">{{ item.group }} #{{ item.index }}</small>
                  <small v-else-if="item.type === 'expression'">{{ item.expressionId || item.id }}</small>
                  <small v-else>{{ JSON.stringify(item).substring(0, 50) }}...</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 实时动作测试 -->
      <div class="test-section">
        <div class="section-header">
          <h3>🎮 实时动作测试</h3>
        </div>
        
        <div class="test-content">
          <div class="emotion-buttons">
            <button 
              v-for="emotion in testEmotions"
              :key="emotion.id"
              class="emotion-btn"
              :style="{ backgroundColor: emotion.color }"
              @click="testEmotionAction(emotion)"
            >
              <span class="emotion-icon">{{ emotion.icon }}</span>
              <span class="emotion-name">{{ emotion.name }}</span>
            </button>
          </div>
          
          <div class="quick-actions">
            <button 
              class="btn btn-outline"
              @click="testRandomIdleAction"
            >
              随机待机动作
            </button>
            <button 
              class="btn btn-outline"
              @click="testClearActions"
            >
              清除所有动作
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 测试结果汇总 -->
    <div class="test-summary" v-if="testResults.length > 0">
      <div class="summary-header">
        <h3>📊 测试结果汇总</h3>
        <div class="summary-stats">
          <span class="stat-item">
            通过: <span class="success">{{ passedTests }}</span>
          </span>
          <span class="stat-item">
            失败: <span class="danger">{{ failedTests }}</span>
          </span>
        </div>
      </div>
      
      <div class="results-list">
        <div 
          v-for="(result, index) in testResults"
          :key="index"
          class="result-item"
          :class="result.status"
        >
          <div class="result-icon">
            <i class="bi" :class="getStatusIcon(result.status)"></i>
          </div>
          <div class="result-content">
            <div class="result-title">{{ result.title }}</div>
            <div class="result-message">{{ result.message }}</div>
            <div class="result-time">{{ formatTime(result.timestamp) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { motionService } from '../../services/motionManagement'
import { MOTION_TYPES, type MotionType } from '../../types/motionManagement'
import { logger } from '../../utils/logger'
import AppIcon from '../icons/AppIcon.vue'

// 响应式数据
const testing = ref(false)
const testText = ref('')
const testMessage = ref('')
const matchResult = ref<any>(null)
const randomTestResult = ref<any>(null)
const performSequence = ref<any[]>(null)
const testResults = ref<any[]>([])

// 状态
const motionTypesStatus = ref('pending')
const motionServiceStatus = ref('pending')
const performTestStatus = ref('pending')

// 测试情绪数据
const testEmotions = ref([
  { id: 'happy', name: '开心', icon: '😊', color: '#4ecdc4' },
  { id: 'angry', name: '生气', icon: '😠', color: '#e03131' },
  { id: 'thinking', name: '思考', icon: '🤔', color: '#45b7d1' },
  { id: 'surprised', name: '惊讶', icon: '😮', color: '#bc6c25' },
  { id: 'welcome', name: '欢迎', icon: '👋', color: '#ff6b6b' },
  { id: 'thanks', name: '感谢', icon: '🙏', color: '#ffd43b' },
  { id: 'apology', name: '道歉', icon: '🙇', color: '#ff8787' },
  { id: 'goodbye', name: '告别', icon: '👋', color: '#dda15e' }
])

// 计算属性
const currentModelMotions = computed(() => motionService.currentModelMotions.value || [])
const currentModelExpressions = computed(() => motionService.currentModelExpressions.value || [])
const totalAssignedMotions = computed(() => {
  const typeInfo = motionService.getMotionTypeInfo()
  let total = 0
  Object.values(typeInfo.motions).forEach(motions => {
    total += motions.length
  })
  return total
})

const passedTests = computed(() => testResults.value.filter(r => r.status === 'success').length)
const failedTests = computed(() => testResults.value.filter(r => r.status === 'error').length)

// 方法
const getStatusText = (status: string) => {
  const statusMap = {
    'pending': '待测试',
    'success': '✅ 通过',
    'error': '❌ 失败',
    'warning': '⚠️ 警告'
  }
  return statusMap[status] || '未知'
}

const getStatusIcon = (status: string) => {
  const iconMap = {
    'success': 'bi-check-circle-fill',
    'error': 'bi-x-circle-fill',
    'warning': 'bi-exclamation-triangle-fill',
    'info': 'bi-info-circle-fill'
  }
  return iconMap[status] || 'bi-question-circle'
}

const addTestResult = (title: string, message: string, status: 'success' | 'error' | 'warning' | 'info') => {
  testResults.value.unshift({
    title,
    message,
    status,
    timestamp: new Date()
  })
  
  // 限制结果数量
  if (testResults.value.length > 50) {
    testResults.value = testResults.value.slice(0, 50)
  }
}

const testMotionMatching = async () => {
  if (!testText.value.trim()) return
  
  try {
    const { motion_matcher } = await import('../../core/motionTypes') // 假设有适配的模块
    const matchedType = motion_matcher.match_motion_type(testText.value)
    const typeInfo = motion_matcher.get_motion_type_info(matchedType)
    
    matchResult.value = {
      typeId: matchedType,
      type: typeInfo,
      matchedKeywords: [] // 这里可以扩展匹配的关键词
    }
    
    addTestResult(
      '动作类型匹配',
      `"${testText.value}" -> ${typeInfo?.name || matchedType}`,
      'success'
    )
    
    motionTypesStatus.value = 'success'
  } catch (error) {
    logger.error('动作匹配测试失败:', error)
    addTestResult('动作类型匹配', `测试失败: ${error}`, 'error')
    motionTypesStatus.value = 'error'
  }
}

const testMotionService = async () => {
  try {
    const randomMotion = motionService.getRandomMotionForType('happy')
    const randomExpression = motionService.getRandomExpressionForType('happy')
    
    randomTestResult.value = {
      motion: randomMotion,
      expression: randomExpression
    }
    
    addTestResult(
      '动作管理服务',
      `随机选择成功: 动作${randomMotion ? '✓' : '✗'}, 表情${randomExpression ? '✓' : '✗'}`,
      randomMotion || randomExpression ? 'success' : 'warning'
    )
    
    motionServiceStatus.value = 'success'
  } catch (error) {
    logger.error('动作服务测试失败:', error)
    addTestResult('动作管理服务', `测试失败: ${error}`, 'error')
    motionServiceStatus.value = 'error'
  }
}

const testPerformSequence = async () => {
  if (!testMessage.value.trim()) return
  
  try {
    // 模拟生成表演序列
    const { motion_matcher } = await import('../../core/motionTypes') // 假设有适配的模块
    const motionType = motion_matcher.match_motion_type(testMessage.value)
    
    // 生成测试序列
    const sequence = [
      {
        type: 'text',
        content: testMessage.value,
        motionType
      },
      {
        type: 'expression',
        expressionId: 'test_expression',
        motionType
      },
      {
        type: 'motion',
        group: 'TestGroup',
        index: 0,
        motionType
      }
    ]
    
    performSequence.value = sequence
    
    const hasMotionTypes = sequence.some(item => item.motionType)
    
    addTestResult(
      '表演序列生成',
      `生成 ${sequence.length} 项，包含动作类型: ${hasMotionTypes ? '是' : '否'}`,
      hasMotionTypes ? 'success' : 'warning'
    )
    
    performTestStatus.value = hasMotionTypes ? 'success' : 'warning'
  } catch (error) {
    logger.error('表演序列测试失败:', error)
    addTestResult('表演序列生成', `测试失败: ${error}`, 'error')
    performTestStatus.value = 'error'
  }
}

const testEmotionAction = async (emotion: any) => {
  try {
    // 模拟发送情绪消息
    const message = `我${emotion.name}了！`
    testMessage.value = message
    await testPerformSequence()
    
    // 这里可以触发实际的动作播放
    if (window.electronAPI?.playMotion) {
      const randomMotion = motionService.getRandomMotionForType(emotion.id)
      if (randomMotion) {
        window.electronAPI.playMotion(randomMotion.groupId, randomMotion.index)
      }
    }
    
    addTestResult(
      '情绪动作测试',
      `测试 ${emotion.name} 情绪动作`,
      'info'
    )
  } catch (error) {
    logger.error('情绪动作测试失败:', error)
    addTestResult('情绪动作测试', `测试失败: ${error}`, 'error')
  }
}

const testRandomIdleAction = async () => {
  try {
    const idleMotion = motionService.getRandomIdleMotion()
    const idleExpression = motionService.getRandomIdleExpression()
    
    if (idleMotion && window.electronAPI?.playMotion) {
      window.electronAPI.playMotion(idleMotion.groupId, idleMotion.index)
    }
    
    if (idleExpression && window.electronAPI?.playExpression) {
      window.electronAPI.playExpression(idleExpression.motionId)
    }
    
    addTestResult(
      '待机动作测试',
      `播放待机动作为: ${idleMotion?.motionName || '无'}`,
      idleMotion ? 'success' : 'warning'
    )
  } catch (error) {
    logger.error('待机动作测试失败:', error)
    addTestResult('待机动作测试', `测试失败: ${error}`, 'error')
  }
}

const testClearActions = async () => {
  try {
    if (window.electronAPI?.clearAllActions) {
      window.electronAPI.clearAllActions()
    }
    
    addTestResult('清除动作测试', '已清除所有正在播放的动作', 'info')
  } catch (error) {
    logger.error('清除动作测试失败:', error)
    addTestResult('清除动作测试', `测试失败: ${error}`, 'error')
  }
}

const runFullTest = async () => {
  testing.value = true
  
  try {
    // 重置状态
    motionTypesStatus.value = 'pending'
    motionServiceStatus.value = 'pending'
    performTestStatus.value = 'pending'
    
    // 1. 测试动作类型系统
    if (MOTION_TYPES.length > 0) {
      motionTypesStatus.value = 'success'
      addTestResult('动作类型系统', `加载了 ${MOTION_TYPES.length} 个动作类型`, 'success')
    } else {
      motionTypesStatus.value = 'error'
      addTestResult('动作类型系统', '未找到任何动作类型', 'error')
    }
    
    // 2. 测试动作管理服务
    await testMotionService()
    
    // 3. 测试表演序列
    testMessage.value = '今天真开心啊！'
    await testPerformSequence()
    
    // 4. 测试各种情绪
    for (const emotion of testEmotions.value.slice(0, 3)) {
      await testEmotionAction(emotion)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    addTestResult('完整测试', '所有测试已完成，请查看详细结果', 'info')
    
  } catch (error) {
    logger.error('完整测试失败:', error)
    addTestResult('完整测试', `测试过程中出现错误: ${error}`, 'error')
  } finally {
    testing.value = false
  }
}

const clearResults = () => {
  testResults.value = []
  matchResult.value = null
  randomTestResult.value = null
  performSequence.value = null
  
  motionTypesStatus.value = 'pending'
  motionServiceStatus.value = 'pending'
  performTestStatus.value = 'pending'
}

const getMotionTypeIcon = (typeId: string) => {
  const motionType = MOTION_TYPES.find(t => t.id === typeId)
  return motionType?.icon || '🎭'
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString()
}

// 生命周期
onMounted(async () => {
  try {
    // 初始化时运行基本检查
    if (MOTION_TYPES.length > 0) {
      motionTypesStatus.value = 'success'
    }
    
    // 尝试从当前模型加载动作
    await motionService.scanFromCurrentModel()
    motionServiceStatus.value = 'success'
  } catch (error) {
    logger.error('初始化测试页面失败:', error)
  }
})
</script>

<style scoped>
.motion-test-page {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
  
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --info-color: #3b82f6;
  --bg-surface: var(--surface-color);
  --bg-app: var(--bg-app);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.page-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.test-actions {
  display: flex;
  gap: 0.5rem;
}

.test-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.test-section {
  background: var(--bg-surface);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.section-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge.pending {
  background: var(--border-color);
  color: var(--text-secondary);
}

.status-badge.success {
  background: var(--success-color);
  color: white;
}

.status-badge.error {
  background: var(--danger-color);
  color: white;
}

.status-badge.warning {
  background: var(--warning-color);
  color: white;
}

.test-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}

.info-item .label {
  color: var(--text-secondary);
}

.info-item .value {
  font-weight: 500;
  color: var(--text-primary);
}

.test-input {
  display: flex;
  gap: 0.5rem;
}

.test-input-field {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-primary);
}

.test-textarea {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-primary);
  resize: vertical;
  min-height: 80px;
}

.test-result {
  background: var(--bg-app);
  border-radius: 6px;
  padding: 1rem;
  border: 1px solid var(--border-color);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.result-type {
  font-size: 1.1rem;
}

.result-id {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.result-details p {
  margin: 0.25rem 0;
  color: var(--text-primary);
}

.result-details small {
  color: var(--text-secondary);
}

.sequence-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sequence-item {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.75rem;
  transition: all 0.2s ease;
}

.sequence-item.with-motion-type {
  border-left: 4px solid var(--primary-color);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.item-type {
  font-weight: 500;
  color: var(--text-primary);
}

.motion-type-badge {
  background: var(--primary-color);
  color: var(--primary-fg);
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
}

.emotion-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.emotion-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.emotion-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.emotion-icon {
  font-size: 1.5rem;
}

.emotion-name {
  font-size: 0.9rem;
  font-weight: 500;
}

.quick-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.test-summary {
  background: var(--bg-surface);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.summary-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.summary-stats {
  display: flex;
  gap: 1rem;
}

.stat-item {
  color: var(--text-secondary);
}

.stat-item .success {
  color: var(--success-color);
  font-weight: 500;
}

.stat-item .danger {
  color: var(--danger-color);
  font-weight: 500;
}

.results-list {
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  background: var(--bg-app);
  border-left: 4px solid var(--border-color);
}

.result-item.success {
  border-left-color: var(--success-color);
}

.result-item.error {
  border-left-color: var(--danger-color);
}

.result-item.warning {
  border-left-color: var(--warning-color);
}

.result-item.info {
  border-left-color: var(--info-color);
}

.result-icon {
  display: flex;
  align-items: flex-start;
  padding-top: 0.125rem;
}

.result-icon.success {
  color: var(--success-color);
}

.result-icon.error {
  color: var(--danger-color);
}

.result-icon.warning {
  color: var(--warning-color);
}

.result-icon.info {
  color: var(--info-color);
}

.result-content {
  flex: 1;
}

.result-title {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.result-message {
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.result-time {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* 按钮样式 */
.btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.btn:hover {
  background: var(--hover-bg);
}

.btn.btn-primary {
  background: var(--primary-color);
  color: var(--primary-fg);
  border-color: var(--primary-color);
}

.btn.btn-outline {
  background: transparent;
}

.btn.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .test-grid {
    grid-template-columns: 1fr;
  }
  
  .emotion-buttons {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  }
  
  .page-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
}
</style>
