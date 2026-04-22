<template>
  <el-config-provider :locale="zhCn">
    <div id="app" :class="{ 'dark-mode': isDarkMode }">
      <!-- Top Control Bar -->
      <div class="top-bar">
        <div class="brand">telegrip</div>
        <div class="controls">
          <!-- 证书授权提示 -->
          <div class="cert-auth-tip" >
            <span class="tip-text">首次使用需接受证书：</span>
            <el-button size="small" type="primary" plain @click="openCertAuth(apiUrl)">API</el-button>
            <el-button size="small" type="success" plain @click="openCertAuth(wsUrl)">WS</el-button>
          </div>
          
          <el-button 
            icon="Tools" 
            circle 
            @click="showCalibration = true"
            title="电机校准"
            class="calibration-btn"
          />
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

      <!-- Calibration Dialog -->
      <el-dialog
        v-model="showCalibration"
        title=""
        width="90%"
        :close-on-click-modal="false"
        class="calibration-dialog"
      >
        <CalibrationPage 
          :status="status"
          @back="showCalibration = false"
        />
      </el-dialog>

      <!-- Main Content - Single Screen Layout -->
      <div class="main-container" v-show="!isVRMode">
        <DesktopInterface 
          :status="status"
          :is-robot-engaged="isRobotEngaged"
          :show-warning="showWarning"
          :vr-server-url="vrServerUrl"
          :is-keyboard-enabled="isKeyboardEnabled"
          :simulation-mode="simulationMode"
          @toggle-robot="toggleRobotEngagement"
          @toggle-keyboard="toggleKeyboardControl"
          @switch-vr="switchToVrView"
          @toggle-simulation="simulationMode = $event"
          @refresh-status="updateStatus"
        />
      </div>

      <!-- VR Scene -->
      <VrScene v-if="isVRMode" />
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { Sunny, Moon } from '@element-plus/icons-vue'
import { useConfig } from '../composables/useConfig'
import { useRobot } from '../composables/useRobot'
import { useKeyboard } from '../composables/useKeyboard'
import SettingsModal from '../components/SettingsModal.vue'
import DesktopInterface from '../components/DesktopInterface.vue'
import CalibrationPage from './Calibration.vue'

// State
const isVRMode = ref(false)
const settingsVisible = ref(false)
const showCalibration = ref(false)
const isDarkMode = ref(false)
const simulationMode = ref(false)

// Router
const router = useRouter()

// 环境变量
const apiUrl = import.meta.env.VITE_API_URL || 'https://localhost:8443'
const wsUrl = import.meta.env.VITE_WS_URL ? import.meta.env.VITE_WS_URL.replace('wss://', 'https://').replace('/ws', '') : 'https://localhost:8442'

// Composables
const { config, saving, restarting, vrServerUrl, sendIntervalMs, loadConfiguration, saveConfiguration, restartSystem } = useConfig()
const { isRobotEngaged, showWarning, status, toggleRobotEngagement, showConnectionWarning, updateStatus } = useRobot()
const { isKeyboardEnabled, toggleKeyboardControl, handleKeyDown, handleKeyUp } = useKeyboard(isRobotEngaged, showConnectionWarning, simulationMode)

// Theme toggle
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
}

// 证书授权
function openCertAuth(url) {
  window.open(url, '_blank')
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
  router.push('/vr-entrance')
}

// Lifecycle

onMounted(() => {
  // Load theme preference
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDarkMode.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
  }
  
  // 初始查询一次状态
  updateStatus()
  
  // 同步全局 WebSocket 状态
  if (window.__globalStatus) {
    status.wsConnected = window.__globalStatus.wsConnected
    // 监听变化
    const observer = new MutationObserver(() => {
      status.wsConnected = window.__globalStatus.wsConnected
    })
    // 简单轮询检查（Vue3 reactive 不会触发MutationObserver）
    const checkInterval = setInterval(() => {
      if (window.__globalStatus) {
        status.wsConnected = window.__globalStatus.wsConnected
      }
    }, 500)
    
    onUnmounted(() => {
      clearInterval(checkInterval)
    })
  }
  
  // Keyboard listeners
  document.addEventListener('keydown', handleKeyDown, { capture: true })
  document.addEventListener('keyup', handleKeyUp, { capture: true })
})

onUnmounted(() => {
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
