<template>
  <div class="settings-section about-section">
    <h2>关于</h2>

    <div class="about-content">
      <div class="about-item">
        <h3>项目信息</h3>
        <p><strong>项目名称：</strong>AstrBot Live2D Desktop</p>
        <p><strong>作者：</strong>lxfight</p>
        <p><strong>版本：</strong>1.0.0</p>
      </div>

      <div class="about-item">
        <h3>版权声明</h3>
        <p>© 2024-2025 lxfight. All rights reserved.</p>
        <p>本项目使用 MIT 协议开源。</p>
      </div>

      <div class="about-item">
        <h3>Live2D® 版权声明</h3>
        <p>Live2D Cubism® 是 Live2D 公司的注册商标。</p>
        <p>本应用使用 Live2D Cubism Core 和 Live2D Cubism SDK。</p>
        <p>Live2D Cubism Core: © Live2D Inc.</p>
        <p>关于 Live2D® 的更多信息，请访问：<a href="https://www.live2d.com" target="_blank" rel="noopener noreferrer">https://www.live2d.com</a></p>
      </div>

      <div class="about-item">
        <h3>第三方库</h3>
        <p>本项目使用以下开源库：</p>
        <ul>
          <li>Vue 3 - MIT License</li>
          <li>Electron - MIT License</li>
          <li>PixiJS - MIT License</li>
          <li>pixi-live2d-display - MIT License</li>
          <li>Pinia - MIT License</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 纯展示组件，无需状态管理
</script>

<style scoped>
.about-section {
  max-width: 800px;
}

.about-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.about-item {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.about-item h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.about-item p {
  margin: 8px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

.about-item strong {
  color: rgba(255, 255, 255, 0.9);
}

.about-item a {
  color: #4a9eff;
  text-decoration: none;
}

.about-item a:hover {
  text-decoration: underline;
}

.about-item ul {
  margin: 8px 0;
  padding-left: 24px;
}

.about-item li {
  margin: 4px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}
</style>
