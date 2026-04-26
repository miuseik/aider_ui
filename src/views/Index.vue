<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <!-- 状态指示器 -->
          <div class="status-indicators">
            <div class="status-item">
              <span class="status-dot" :class="{ connected: status.left_arm_connected }"></span>
              <span>左臂</span>
            </div>
            <div class="status-item">
              <span class="status-dot" :class="{ connected: status.right_arm_connected }"></span>
              <span>右臂</span>
            </div>
            <div class="status-item">
              <span class="status-dot" :class="{ connected: status.vrConnected }"></span>
              <span>VR</span>
            </div>
            <div class="status-item">
              <span class="status-dot" :class="{ connected: status.wsConnected }"></span>
              <span>WS</span>
            </div>
          </div>
        </div>
        
        <div class="toolbar-right">
          <!-- 连接机器人按钮 -->
          <el-button 
            type="primary"
            @click="toggleRobotEngagement"
            class="engage-btn"
          >
            {{ isRobotEngaged ? '🔌 断开' : '🔌 连接' }}
          </el-button>
          
          <!-- 仿真模式复选框 -->
          <label class="simulation-mode-label">
            <input 
              type="checkbox" 
              v-model="simulationMode"
              @change="$emit('toggle-simulation', $event.target.checked)" 
            />
            🧪 仿真测试模式
          </label>
          
          <!-- 设置按钮 -->
          <el-button 
            icon="Setting" 
            circle 
            @click="openSettings"
            title="设置"
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
      <div v-show="!isVRMode">
        <DesktopInterface 
          :status="status"
          :vr-server-url="vrServerUrl"
          :is-keyboard-enabled="isKeyboardEnabled"
          @toggle-keyboard="toggleKeyboardControl"
          @switch-vr="switchToVrView"
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
import { ElConfigProvider, ElMessage } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { useConfig } from '../composables/useConfig'
import { useRobot } from '../composables/useRobot'
import { useKeyboard } from '../composables/useKeyboard'
import { wsClient } from '../utils/websocket'
import SettingsModal from '../components/SettingsModal.vue'
import DesktopInterface from '../components/DesktopInterface.vue'

// State
const isVRMode = ref(false)
const settingsVisible = ref(false)
const simulationMode = ref(false)
const wsConnected = ref(false)

// Router
const router = useRouter()

// 环境变量
const apiUrl = import.meta.env.VITE_API_URL || 'https://localhost:8442'
const wsUrl = import.meta.env.VITE_WS_URL ? import.meta.env.VITE_WS_URL.replace('wss://', 'https://').replace('/ws', '') : 'https://localhost:8442'

// Composables
const { config, saving, restarting, vrServerUrl, sendIntervalMs, loadConfiguration, saveConfiguration, restartSystem } = useConfig()
const { isRobotEngaged, showWarning, status, toggleRobotEngagement, showConnectionWarning, updateStatus } = useRobot()
const { isKeyboardEnabled, toggleKeyboardControl, handleKeyDown, handleKeyUp } = useKeyboard(isRobotEngaged, showConnectionWarning, simulationMode)

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
  // 初始查询一次状态
  updateStatus()
  
  // 同步全局 WebSocket 状态
  if (window.__globalStatus) {
    status.wsConnected = window.__globalStatus.wsConnected
    wsConnected.value = window.__globalStatus.wsConnected
    // 监听变化
    const observer = new MutationObserver(() => {
      status.wsConnected = window.__globalStatus.wsConnected
      wsConnected.value = window.__globalStatus.wsConnected
    })
    // 简单轮询检查（Vue3 reactive 不会触发MutationObserver）
    const checkInterval = setInterval(() => {
      if (window.__globalStatus) {
        status.wsConnected = window.__globalStatus.wsConnected
        wsConnected.value = window.__globalStatus.wsConnected
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
/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(100, 200, 255, 0.2);
  margin-bottom: 20px;
}

.toolbar-left {
  display: flex;
  align-items: center;
}

.status-indicators {
  display: flex;
  gap: 16px;
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #ff453a;
      transition: all 0.3s ease;
      
      &.connected {
        background-color: #34c759;
        box-shadow: 0 0 8px rgba(52, 199, 89, 0.5);
      }
    }
  }
}

.brand {
  font-size: 20px;
  font-weight: bold;
  color: rgba(100, 200, 255, 0.9);
  letter-spacing: 3px;
  text-shadow: 0 0 10px rgba(100, 200, 255, 0.3);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.simulation-mode-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  
  input[type="checkbox"] {
    cursor: pointer;
  }
}

.settings-btn {
  &:hover {
    transform: scale(1.1);
  }
}
</style>
