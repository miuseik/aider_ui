<template>
  <el-config-provider :locale="zhCn">
    <div id="app" :class="{ 'dark-mode': isDarkMode }">
      <!-- Top Control Bar -->
      <div class="top-bar">
        <div class="brand">telegrip</div>
        <div class="controls">
          <!-- 证书授权提示 -->
          <div class="cert-auth-tip">
            <span class="tip-text">首次使用需接受证书：</span>
            <el-button size="small" type="primary" plain @click="openCertAuth('dev')">开发环境</el-button>
            <el-button size="small" type="success" plain @click="openCertAuth('prod-api')">生产-API</el-button>
            <el-button size="small" type="success" plain @click="openCertAuth('prod-ws')">生产-WS</el-button>
          </div>
          
          <el-button 
            :icon="isDarkMode ? Sunny : Moon"
            circle 
            @click="toggleTheme"
            class="theme-btn"
          />
          <el-button 
            icon="Setting" 
            circle 
            @click="openSettings"
            class="settings-btn"
          />
        </div>
      </div>

      <!-- Settings Modal -->
      <el-dialog
        v-model="settingsVisible"
        title="系统设置"
        width="600px"
        :close-on-click-modal="false"
      >
        <SettingsModal 
          v-model:send-interval-ms="sendIntervalMs"
          :visible="settingsVisible"
          :config="config"
          :saving="saving"
          :restarting="restarting"
          @close="closeSettings"
          @save="saveConfiguration"
          @restart="restartSystem"
        />
      </el-dialog>

      <!-- Main Content - Single Screen Layout -->
      <div class="main-container" v-show="!isVRMode && !showVrEntrance">
        <DesktopInterface 
          :status="status"
          :is-robot-engaged="isRobotEngaged"
          :show-warning="showWarning"
          :vr-server-url="vrServerUrl"
          :is-keyboard-enabled="isKeyboardEnabled"
          @toggle-robot="toggleRobotEngagement"
          @toggle-keyboard="toggleKeyboardControl"
          @switch-vr="switchToVrView"
        />
      </div>

      <!-- VR Entrance UI -->
      <VrEntrance v-if="showVrEntrance && !isVRMode" @vr-entered="handleVrEntered" />

      <!-- VR Scene -->
      <VrScene v-if="isVRMode" />
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { Sunny, Moon } from '@element-plus/icons-vue'
import { wsClient } from '../utils/websocket'
import { useConfig } from '../composables/useConfig'
import { useRobot } from '../composables/useRobot'
import { useKeyboard } from '../composables/useKeyboard'
import SettingsModal from '../components/SettingsModal.vue'
import DesktopInterface from '../components/DesktopInterface.vue'
import VrScene from './VrScene.vue'
import VrEntrance from './VrEntrance.vue'

// Composables
const { config, saving, restarting, vrServerUrl, sendIntervalMs, loadConfiguration, saveConfiguration, restartSystem } = useConfig()
const { isRobotEngaged, showWarning, status, toggleRobotEngagement, showConnectionWarning, updateStatus } = useRobot()
const { isKeyboardEnabled, toggleKeyboardControl, handleKeyDown, handleKeyUp } = useKeyboard(isRobotEngaged, showConnectionWarning)

// State
const isVRMode = ref(false)
const showVrEntrance = ref(false)
const settingsVisible = ref(false)
const isDarkMode = ref(false)

// Theme toggle
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
}

// 证书授权
function openCertAuth(env) {
  const urls = {
    dev: 'https://172.19.129.184:8442',
    'prod-api': 'https://api.houqicg.com',
    'prod-ws': 'https://ws.houqicg.com'
  }
  window.open(urls[env], '_blank')
}

// Settings functions
function openSettings() {
  settingsVisible.value = true
  loadConfiguration()
}

function closeSettings() {
  settingsVisible.value = false
}

// VR mode toggle
function switchToVrView() {
  showVrEntrance.value = true
}

function handleVrEntered() {
  isVRMode.value = true
  showVrEntrance.value = false
}

// Lifecycle
let statusInterval = null
let wsUnsubscribe = null

onMounted(() => {
  // Load theme preference
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDarkMode.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
  }
  
  // Start status monitoring
  updateStatus()
  statusInterval = setInterval(updateStatus, 2000)
  
  // Connect WebSocket
  wsClient.connect()
  
  // 立即设置初始状态
  status.wsConnected = wsClient.isConnected
  
  wsUnsubscribe = wsClient.onMessage((data) => {
    if (data.type === 'connected') {
      status.wsConnected = true
    } else if (data.type === 'disconnected' || data.type === 'error') {
      status.wsConnected = false
    }
  })
  
  // Keyboard listeners
  document.addEventListener('keydown', handleKeyDown, { capture: true })
  document.addEventListener('keyup', handleKeyUp, { capture: true })
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
  
  // Disconnect WebSocket
  if (wsUnsubscribe) {
    wsUnsubscribe()
  }
  wsClient.disconnect()
  
  document.removeEventListener('keydown', handleKeyDown, { capture: true })
  document.removeEventListener('keyup', handleKeyUp, { capture: true })
})
</script>

<style lang="scss" scoped>
/* 组件特定样式 */
.cert-auth-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 12px;
  padding: 6px 12px;
  background: rgba(255, 193, 7, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 193, 7, 0.3);
  
  .tip-text {
    font-size: 13px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }
}
</style>
