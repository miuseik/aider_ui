<template>
  <div class="top-bar">
    <div class="logo" @click="goHome">Aider VR</div>
    <div class="nav-menu">
      <router-link to="/profile" class="nav-item">
        <span class="nav-icon">◈</span>
        <span>个人中心</span>
      </router-link>
      <button class="theme-btn" @click="toggleTheme" title="切换主题">
        <span>{{ isDarkMode ? '☀️' : '🌙' }}</span>
      </button>
      <div class="status">
        <span class="status-dot" :class="{ connected: wsConnected }"></span>
        <span class="status-text">{{ wsConnected ? '已连接' : '未连接' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const isDarkMode = ref(true)

const wsConnected = computed(() => {
  return window.__globalStatus?.wsConnected || false
})

function goHome() {
  router.push('/')
}

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'light') {
    isDarkMode.value = false
    document.documentElement.classList.remove('dark')
  } else {
    document.documentElement.classList.add('dark')
  }
})
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

.nav-menu {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: rgba(100, 200, 255, 0.9);
  text-decoration: none;
  font-size: 14px;
  letter-spacing: 2px;
  border: 1px solid transparent;
  transition: all 0.3s;

  &:hover {
    border-color: rgba(100, 200, 255, 0.6);
    background: rgba(100, 200, 255, 0.1);
    box-shadow: 0 0 10px rgba(100, 200, 255, 0.3);
  }

  &.router-link-active {
    border-color: rgba(100, 200, 255, 0.8);
    background: rgba(100, 200, 255, 0.15);
    color: #fff;
  }
}

.nav-icon {
  font-size: 16px;
}

.theme-btn {
  background: transparent;
  border: 1px solid rgba(100, 200, 255, 0.4);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s;

  &:hover {
    background: rgba(100, 200, 255, 0.1);
    border-color: rgba(100, 200, 255, 0.6);
    transform: scale(1.1);
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
