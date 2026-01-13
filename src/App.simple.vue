<template>
  <div class="app-container">
    <Live2DRenderer ref="renderer" />
    
    <!-- 调试按钮 -->
    <div class="debug-controls">
      <button @click="testMotion">播放动作</button>
      <button @click="testExpression">切换表情</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Live2DRenderer from './components/Live2DRenderer.vue'

const renderer = ref()

const testMotion = () => {
  console.log('测试播放动作')
  renderer.value?.playMotion('Idle', 0)
}

const testExpression = () => {
  console.log('测试切换表情')
  renderer.value?.setExpression('f01')
}
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.debug-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 1000;
}

button {
  padding: 10px 20px;
  background: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

button:active {
  transform: translateY(0);
}
</style>
