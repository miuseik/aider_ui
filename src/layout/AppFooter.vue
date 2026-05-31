<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div class="footer-left">
        <span class="brand">Aider VR</span>
        <span class="version">v2.0.77</span>
      </div>
      <div class="footer-center">
        <span>© 2026 Aider VR System</span>
      </div>
      <div class="footer-right">
        <span class="status-indicator">
          <span class="dot" :class="{ active: wsConnected }"></span>
          {{ wsConnected ? '系统在线' : '离线' }}
        </span>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'

const wsConnected = computed(() => {
  return window.__globalStatus?.wsConnected || false
})
</script>

<style scoped lang="scss">
.app-footer {
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0, 255, 136, 0.2);
  padding: 15px 30px;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.brand {
  color: #00ff88;
  font-weight: bold;
  font-size: 14px;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.version {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-family: monospace;
}

.footer-center {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.footer-right {
  display: flex;
  align-items: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff4444;
  box-shadow: 0 0 8px rgba(255, 68, 68, 0.5);
  transition: all 0.3s ease;

  &.active {
    background: #00ff88;
    box-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
  }
}
</style>
