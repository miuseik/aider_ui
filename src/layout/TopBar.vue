<template>
  <div class="top-bar">
    <div class="logo" @click="goHome">Aider VR</div>
    <div class="nav-menu">
      <router-link 
        v-for="item in navItems" 
        :key="item.path"
        :to="item.path" 
        class="nav-item" 
        :class="{ active: isActive(item.path) }"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </router-link>
      <button class="theme-btn" @click="toggleTheme" title="切换主题">
        <span>{{ isDarkMode ? '☀️' : '🌙' }}</span>
      </button>
      <button class="theme-btn" @click="wsTest" title="ws连接">
        <span>ws连接</span>
      </button>
      <button class="settings-btn" @click="openSettings" title="系统设置">
        <span>⚙️</span>
      </button>
      <div class="status">
        <span class="status-dot" :class="{ connected: wsConnected }"></span>
        <span class="status-text">{{ wsConnected ? '已连接' : '未连接' }}{{wsConnected}}</span>
      </div>
    </div>
  </div>
  
  <!-- 设置对话框 - 使用 teleport 挂载到 body -->
  <Teleport to="body">
    <el-dialog
      v-model="settingsVisible"
      title="系统设置"
      width="700px"
      :close-on-click-modal="false"
    >
      <SettingsModal 
        :config="config"
        :saving="saving"
        :restarting="restarting"
        :send-interval-ms="sendIntervalMs"
        @close="settingsVisible = false"
        @save="handleSave"
        @restart="handleRestart"
        @update:sendIntervalMs="sendIntervalMs = $event"
      />
    </el-dialog>
  </Teleport>


</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SettingsModal from '@/components/SettingsModal.vue'
import { useConfig } from '@/composables/useConfig.js'
import { wsClient } from '@/utils/websocket.js'

const router = useRouter()
const route = useRoute()
const { config, saving, restarting, sendIntervalMs, loadConfiguration, saveConfiguration, restartSystem } = useConfig()

const isDarkMode = ref(true)
const settingsVisible = ref(false)

const navItems = [
  { path: '/', icon: '🏠', label: '首页' },
  // { path: '/Hardware-info', icon: '🎯', label: '硬件信息' },
  // { path: '/calibration', icon: '🎯', label: '硬件信息' },
  { path: '/servo-manager', icon: '🔧', label: '电机管理' },
  { path: '/camera', icon: '📷', label: '摄像头' },
  { path: '/vr-entrance', icon: '🥽', label: 'VR控制' },
  { path: '/profile', icon: '◈', label: '个人中心' }
]

const wsConnected = computed(() => {
  return wsClient.isConnected
})

function goHome() {
  router.push('/')
}

function isActive(path) {
  return route.path === path
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

function wsTest() {
window.open(`https://${window.location.hostname}:8442`, '_blank')
}
function openSettings() {
  settingsVisible.value = true
  loadConfiguration()
}

async function handleSave() {
  await saveConfiguration()
}

async function handleRestart() {
  await restartSystem()
  settingsVisible.value = false
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
  gap: 12px;
  margin-left: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  color: rgba(100, 200, 255, 0.9);
  text-decoration: none;
  font-size: 13px;
  letter-spacing: 1px;
  border: 1px solid transparent;
  transition: all 0.3s;

  &:hover {
    border-color: rgba(100, 200, 255, 0.6);
    background: rgba(100, 200, 255, 0.1);
    box-shadow: 0 0 10px rgba(100, 200, 255, 0.3);
  }

  &.active {
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

.settings-btn {
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
