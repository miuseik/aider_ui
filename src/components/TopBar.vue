<template>
  <div class="top-bar">
    <div class="logo" @click="goHome">Aider VR</div>
    <div class="status">
      <span class="status-dot" :class="{ connected: wsConnected }"></span>
      <span class="status-text">{{ wsConnected ? '已连接' : '未连接' }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const wsConnected = computed(() => {
  return window.__globalStatus?.wsConnected || false
})

function goHome() {
  router.push('/')
}
</script>

<style scoped lang="scss">
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  z-index: 10000;
  border-bottom: 1px solid rgba(0, 255, 136, 0.2);
}

.logo {
  font-size: 24px;
  font-weight: bold;
  color: #00ff88;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    color: #00cc6a;
    text-shadow: 0 0 15px rgba(0, 255, 136, 0.8);
  }
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff4444;
  box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
  transition: all 0.3s ease;

  &.connected {
    background: #00ff88;
    box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
  }
}

.status-text {
  color: white;
  font-size: 14px;
}
</style>
