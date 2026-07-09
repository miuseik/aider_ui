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

            <!-- 第四行：硬件连接状态 -->
            <el-row :gutter="12" style="margin-top: 6px;">
              <el-col :span="6">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.robot_connected }"></span>
                  <el-tag size="small" :type="liveStatus.robot_connected ? 'success' : 'info'">机器人</el-tag>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.base_connected }"></span>
                  <el-tag size="small" :type="liveStatus.base_connected ? 'success' : 'info'">底盘</el-tag>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.lift_connected }"></span>
                  <el-tag size="small" :type="liveStatus.lift_connected ? 'success' : 'info'">升降轴</el-tag>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.visualizer_connected }"></span>
                  <el-tag size="small" :type="liveStatus.visualizer_connected ? 'success' : 'info'">仿真</el-tag>
                </div>
              </el-col>
            </el-row>
          </div>
        </div>
<!--        刷新状态-->
        <div>
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
            :type="isRobotEngaged ? 'danger' : 'primary'"
            :loading="connecting"
            :disabled="connecting"
            @click="toggleRobotEngagement"
          >
            {{ connecting ? (isRobotEngaged ? '断开中…' : '连接中…') : (isRobotEngaged ? '🔴🔌 断开' : '🟢 🔌连接') }}
          </el-button>
          <!-- 重新标零按钮（掉圈数时显示） -->
          <el-button
            v-if="liveStatus.lost_multiturn.length > 0"
            type="warning"
            :loading="calibrating"
            :disabled="calibrating"
            @click="onRecalibrateClick"
          >
            ⚠️ 重新标零 ({{ liveStatus.lost_multiturn.length }})
          </el-button>
          <!-- CAN 恢复按钮（始终可见，点连接后才生效） -->
          <el-button
            type="warning"
            :loading="recoveringCan"
            :disabled="recoveringCan"
            @click="onCanRecoverClick"
          >
            🔄 CAN 恢复
          </el-button>
        </div>
      </div>
      <!-- Main Content - Single Screen Layout -->
      <KeyboardHelp
        :is-keyboard-enabled="isKeyboardEnabled"
        :pose-list="poseList"
        :current-pose-name="currentPoseName"
        :pose-loading="poseLoading"
        :show-pose-selector="showPoseSelector"
        @toggle="toggleKeyboardControl"
        @pose-change="onPoseSelected"
      />

      <RobotHardwareInfo
        :robot-config="liveRobotConfig"
        :scanning="false"
      />
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElConfigProvider, ElMessageBox, ElMessage } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { useConfig } from '../composables/useConfig'
import { useRobot } from '../composables/useRobot'
import { useKeyboard } from '../composables/useKeyboard'
import KeyboardHelp from '../components/KeyboardHelp.vue'
import RobotHardwareInfo from '../components/RobotHardwareInfo.vue'
import { useServoStore } from '@/stores/servo'
import { wsClient } from '@/utils/websocket'

// Router
const router = useRouter()

// Composables
const { vrServerUrl } = useConfig()
const {
  isRobotEngaged, showWarning, connecting, calibrating, recoveringCan,
  toggleRobotEngagement, showConnectionWarning, updateStatus, recalibrateMultiturn, canRecover,
  poseList, currentPoseName, poseLoading, fetchPoses, gotoPose,
} = useRobot()
const { isKeyboardEnabled, toggleKeyboardControl, handleKeyDown, handleKeyUp } = useKeyboard(isRobotEngaged, showConnectionWarning)

// 姿态选择器显隐：WebSocket 连接且已加载姿态列表时显示
const showPoseSelector = computed(() => Object.keys(poseList.value).length > 0)

// State
const refreshing = ref(false)

// === 从 Pinia 读取机器人硬件配置（App.vue 初始化时已加载） ===
const servoStore = useServoStore()
const liveRobotConfig = computed(() => servoStore.servoIdConfig)

// === 扫描到的舵机列表（由 /api/status 返回，供 RobotPart inject 使用） ===
const foundServos = ref([])
provide('foundServos', foundServos)

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
  // 新增硬件状态
  base_connected: false,
  lift_connected: false,
  robot_connected: false,
  visualizer_connected: false,
  lift_height_mm: 0,
  left_arm_angles: [],
  right_arm_angles: [],
  // 扫描到的在线舵机
  servos: [],
  network: { ip: '--', ssid: '--', hostname: '--' },
  // 多圈丢失电机列表
  lost_multiturn: [],
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
        // 新增硬件状态
        base_connected: !!data.base_connected,
        lift_connected: !!data.lift_connected,
        robot_connected: !!data.robot_connected,
        visualizer_connected: !!data.visualizer_connected,
        lift_height_mm: data.lift_height_mm || 0,
        left_arm_angles: data.left_arm_angles || [],
        right_arm_angles: data.right_arm_angles || [],
        // 扫描到的在线舵机
        servos: data.servos || [],
        network: data.network || { ip: '--', ssid: '--', hostname: '--' },
        // 多圈丢失电机列表
        lost_multiturn: data.lost_multiturn || [],
      }
      // 同步 foundServos 给 RobotPart inject 使用
      foundServos.value = data.servos || []
    }
  } finally {
    refreshing.value = false
  }
}

// 姿态选择回调
function onPoseSelected(poseName) {
  if (!poseName) return
  gotoPose(poseName, 'both')
}

// CAN 恢复：点击按钮触发
async function onCanRecoverClick() {
  try {
    await ElMessageBox.confirm(
      '将尝试重置卡死的 USB CAN 适配器并重新初始化 CAN 总线。\n\n完成后请重新连接机器人。',
      'CAN 总线恢复',
      { confirmButtonText: '开始恢复', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return  // 用户取消
  }
  await canRecover()
}

// 重新标零：点击按钮触发
async function onRecalibrateClick() {
  try {
    await ElMessageBox.confirm(
      `检测到 ${liveStatus.value.lost_multiturn.length} 个电机多圈编码器丢失，需要重新标零。\n\n` +
      '电机将自动转到零位后标零，完成后请重新连接机器人。',
      '需重新标零',
      { confirmButtonText: '开始标零', cancelButtonText: '稍后', type: 'warning' }
    )
  } catch {
    return  // 用户取消
  }
  await recalibrateMultiturn()
  // 标零完成后自动刷新状态
  await syncLiveStatus()
}

// 监听掉圈电机，连接成功后自动弹窗提示
let shownMultiturnIds = new Set()
watch(() => liveStatus.value.lost_multiturn, (lost) => {
  if (!lost || lost.length === 0) {
    shownMultiturnIds = new Set()
    return
  }
  // 只在连接成功后（robot_connected=true）且首次出现时弹窗
  if (!liveStatus.value.robot_connected) return
  const ids = lost.map(m => m.id).sort().join(',')
  if (shownMultiturnIds.has(ids)) return
  shownMultiturnIds.add(ids)

  ElMessageBox.confirm(
    `检测到 ${lost.length} 个电机多圈编码器丢失（断电导致）：\n\n` +
    lost.map(m => `  • ID=${m.id} ${m.joint_name}: 读数 ${m.raw_angle}° → 实际约 ${m.corrected_angle}°`).join('\n') +
    `\n\n电机将自动转至零位后标零，完成后请重新连接。`,
    '⚠️ 检测到多圈丢失',
    { confirmButtonText: '立即重新标零', cancelButtonText: '稍后处理', type: 'warning' }
  ).then(() => {
    recalibrateMultiturn().then(() => syncLiveStatus())
  }).catch(() => {})
})

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

// WebSocket 硬件信息监听器（一次性推送，不轮询）
let wsUnsubscribe = null

onMounted(() => {
  // 首先用 store 已有的状态快速初始化按钮，避免闪烁
  if (isRobotEngaged.value) {
    liveStatus.value.robotEngaged = true
  }

  // 初始同步一次全量状态（会用服务端真实状态覆盖 store）
  syncLiveStatus().then(() => {
    // 始终获取可用姿态列表（含仿真模式，不依赖真机连接状态）
    fetchPoses()
  })

  // 监听 robot_hardware_info：实时更新页面上的硬件连接状态指示器
  // 注意：机器人连接/断开 + 姿态同步已由 App.vue 全局监听处理
  wsUnsubscribe = wsClient.onMessage((data) => {
    if (data.type === 'robot_hardware_info') {
      liveStatus.value = {
        ...liveStatus.value,
        robot_connected: !!data.robot_connected,
        left_arm_connected: !!data.left_arm_connected,
        right_arm_connected: !!data.right_arm_connected,
        base_connected: !!data.base_connected,
        lift_connected: !!data.lift_connected,
        robotEngaged: !!data.robot_connected,
        left_arm_angles: data.left_arm_angles || [],
        right_arm_angles: data.right_arm_angles || [],
        lift_height_mm: data.lift_height_mm || 0,
        lost_multiturn: data.lost_multiturn || [],
      }
    }
  })

  // 如果首次加载 servos 为空且 Terminal 在线，3 秒后重试一次
  // （后台正在自动扫描舵机，延时后 /api/status 会有数据）
  setTimeout(() => {
    if (liveStatus.value.terminal_connected && liveStatus.value.servos.length === 0) {
      syncLiveStatus()
    }
  }, 3000)

  // Keyboard listeners
  document.addEventListener('keydown', handleKeyDown, { capture: true })
  document.addEventListener('keyup', handleKeyUp, { capture: true })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown, { capture: true })
  document.removeEventListener('keyup', handleKeyUp, { capture: true })
  // 取消 WebSocket 硬件状态监听
  if (wsUnsubscribe) {
    wsUnsubscribe()
    wsUnsubscribe = null
  }
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
