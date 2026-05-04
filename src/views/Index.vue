yi<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <!-- 状态指示器 -->
          <div class="status-indicators">
            <!-- 第一行：基础连接状态 -->
            <el-row :gutter="12" style="margin-bottom: 8px;">
              <el-col :span="6">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.left_arm_connected }"></span>
                  <el-tag size="small">左臂</el-tag>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.right_arm_connected }"></span>
                  <el-tag size="small">右臂</el-tag>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.vrConnected }"></span>
                  <el-tag size="small">VR</el-tag>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.wsConnected }"></span>
                  <el-tag size="small">WS</el-tag>
                </div>
              </el-col>
            </el-row>

            <!-- 第二行：网络与系统信息 -->
            <el-row :gutter="12" style="margin-bottom: 8px;">
              <el-col :span="8">
                <el-tag type="info" effect="plain" size="small">
                  📡 {{ liveStatus.network.hostname }} | {{ liveStatus.network.ip }}
                </el-tag>
              </el-col>
            </el-row>

            <!-- 第三行：详细状态 -->
            <el-row :gutter="24">
              <el-col :span="8">
                <el-tag 
                  :type="liveStatus.terminal_connected ? 'success' : 'info'" 
                  effect="light" 
                  size="small"
                >
                  {{ liveStatus.terminal_connected ? '✅ Terminal' : '❌ Terminal' }}
                </el-tag>
              </el-col>
              <el-col :span="8">
                <el-tag 
                  :type="liveStatus.keyboardEnabled ? 'success' : 'info'" 
                  effect="light" 
                  size="small"
                >
                  {{ liveStatus.keyboardEnabled ? '⌨️ 键盘' : '⌨️ 键盘关' }}
                </el-tag>
              </el-col>
              <el-col :span="8">
                <el-tag type="warning" effect="light" size="small">
                  👥 在线: {{ liveStatus.clients_count || 0 }}
                </el-tag>
              </el-col>
            </el-row>
          </div>
        </div>
<!--        刷新状态-->
        <div class="toolbar-right">
          <!-- 刷新状态按钮 -->
          <el-button
            type="info"
            @click="syncLiveStatus"
            :loading="refreshing"
            class="refresh-btn"
          >
            🔄 刷新
          </el-button>
          <!-- 连接机器人按钮 -->
          <el-button
            type="primary"
            @click="toggleRobotEngagement"
            class="engage-btn"
          >
            {{ isRobotEngaged ? '🔌 断开' : '🔌 连接' }}
          </el-button>
        </div>
      </div>



      <!-- Main Content - Single Screen Layout -->
      <div v-show="!isVRMode">
        <DesktopInterface 
          :status="liveStatus"
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
import { ElConfigProvider, ElMessageBox } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { useConfig } from '../composables/useConfig'
import { useRobot } from '../composables/useRobot'
import { useKeyboard } from '../composables/useKeyboard'
import DesktopInterface from '../components/DesktopInterface.vue'

// State
const isVRMode = ref(false)
const wsConnected = ref(false)
const refreshing = ref(false)

// Router
const router = useRouter()

// Composables
const { vrServerUrl } = useConfig()
const { isRobotEngaged, showWarning, toggleRobotEngagement, showConnectionWarning, updateStatus } = useRobot()
const { isKeyboardEnabled, toggleKeyboardControl, handleKeyDown, handleKeyUp } = useKeyboard(isRobotEngaged, showConnectionWarning)

// 定义本地响应式变量来存储即时获取的全量状态
const liveStatus = ref({
  left_arm_connected: false,
  right_arm_connected: false,
  vrConnected: false,
  wsConnected: false,
  terminal_connected: false,
  keyboardEnabled: false,
  clients_count: 0,
  robotEngaged: false,
  network: { ip: '--', ssid: '--', hostname: '--' }
})

// 统一的状态同步函数
const syncLiveStatus = async () => {
  refreshing.value = true
  try {
    const {data} = await updateStatus()
    if (data) {
      liveStatus.value = {
        left_arm_connected: !!data.left_arm_connected,
        right_arm_connected: !!data.right_arm_connected,
        vrConnected: !!data.vrConnected,
        wsConnected: !!data.wsConnected,
        terminal_connected: !!data.terminal_connected,
        keyboardEnabled: !!data.keyboardEnabled,
        clients_count: data.clients_count || 0,
        robotEngaged: !!data.robotEngaged,
        network: data.network || { ip: '--', ssid: '--', hostname: '--' }
      }
    }
    console.log('✅ 获取到即时状态数据:', liveStatus.value)
  } finally {
    refreshing.value = false
  }
}

// VR mode toggle
function switchToVrView() {
  router.push('/vr-entrance')
}

// 检查 WebSocket 连接状态
const checkWsConnection = async () => {
  await syncLiveStatus()
  const isConnected = liveStatus.value.wsConnected
  // 注意：terminal_connected 字段如果接口没返回，这里可能需要根据 wsConnected 推断或从 data 中获取
  const terminalConnected = liveStatus.value.wsConnected // 暂时用 wsConnected 代替，或者确认接口是否有 terminal_connected

  let message = ''
  if (isConnected && terminalConnected) {
    message = '✅ WebSocket 已连接\n✅ Terminal 已连接'
  } else if (isConnected && !terminalConnected) {
    message = '✅ WebSocket 已连接\n❌ Terminal 未连接'
  } else if (!isConnected && terminalConnected) {
    message = '❌ WebSocket 未连接\n✅ Terminal 已连接'
  } else {
    message = '❌ WebSocket 未连接\n❌ Terminal 未连接'
  }

  await ElMessageBox.alert(
    message,
    'WebSocket 连接状态',
    {
      confirmButtonText: '确定',
      type: isConnected ? 'success' : 'warning'
    }
  )
}

// Lifecycle

onMounted(() => {
  // 初始同步一次全量状态
  syncLiveStatus()

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
  .status-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #ff453a;
      transition: all 0.3s ease;
      flex-shrink: 0;
      display: inline-block;

      &.connected {
        background-color: #34c759;
        box-shadow: 0 0 8px rgba(52, 199, 89, 0.6);
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

.ws-btn {
  font-weight: 600;
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
</style>
