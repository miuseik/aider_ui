<template>
  <div id="app">
    <!-- Settings Button -->
    <div class="settings-button" @click="openSettings">
      ⚙️
    </div>

    <!-- Settings Modal -->
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

    <!-- Desktop Interface -->
    <DesktopInterface 
      v-show="!isVRMode && !showVrEntrance"
      :status="status"
      :is-robot-engaged="isRobotEngaged"
      :show-warning="showWarning"
      :vr-server-url="vrServerUrl"
      :is-keyboard-enabled="isKeyboardEnabled"
      @toggle-robot="toggleRobotEngagement"
      @toggle-keyboard="toggleKeyboardControl"
      @switch-vr="switchToVrView"
    />

    <!-- VR Entrance UI (shown when clicking 'Switch to VR') -->
    <VrEntrance v-if="showVrEntrance && !isVRMode" @vr-entered="handleVrEntered" />

    <!-- VR Scene (shown when in immersive VR) -->
    <VrScene v-if="isVRMode" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
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
const isVRMode = ref(false)  // true = 已进入沉浸式 VR
const showVrEntrance = ref(false)  // true = 显示 VR 入口 UI
const settingsVisible = ref(false)

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

<style>
@import '../styles/styles.css';
</style>
