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
              <el-col :span="4">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.left_arm_connected }"></span>
                  <el-tag size="small">左臂</el-tag>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.right_arm_connected }"></span>
                  <el-tag size="small">右臂</el-tag>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.vrConnected }"></span>
                  <el-tag size="small">VR</el-tag>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.wsConnected }"></span>
                  <el-tag size="small">WS</el-tag>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="status-item">
                  <span class="status-dot" :class="{ connected: liveStatus.exoskeleton_connected }"></span>
                  <el-tag size="small" :type="liveStatus.exoskeleton_connected ? 'success' : 'info'">外骨骼</el-tag>
                </div>
              </el-col>
              <el-col :span="4">
                <div class="status-item" v-if="liveStatus.exoskeleton_connected">
                  <el-tag size="small" type="warning">🦴 {{ liveStatus.exoskeleton_angles?.length || 0 }}路</el-tag>
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
          <!-- 全部禁用 / 全部使能 -->
          <el-button
            type="danger"
            :loading="disablingAll"
            :disabled="disablingAll"
            @click="onDisableAllClick"
          >
            ⏹️ 全部禁用
          </el-button>
          <el-button
            type="success"
            :loading="enablingAll"
            :disabled="enablingAll"
            @click="onEnableAllClick"
          >
            ▶️ 全部使能
          </el-button>
        </div>
      </div>
      <!-- Main Content - Single Screen Layout -->
      <!-- 外骨骼关节角度显示 -->
      <div v-if="liveStatus.exoskeleton_connected && liveStatus.exoskeleton_angles?.length" class="exo-panel">
        <div class="exo-header">
          <span class="exo-title">🦴 外骨骼关节角度 ({{ liveStatus.exoskeleton_angles.length }}路)</span>
          <span class="exo-time" v-if="liveStatus.exoskeleton_timestamp">
            {{ new Date(liveStatus.exoskeleton_timestamp).toLocaleTimeString() }}
          </span>
        </div>
        <div class="exo-angles">
          <div
            v-for="(angle, idx) in liveStatus.exoskeleton_angles"
            :key="idx"
            class="exo-angle-item"
          >
            <span class="exo-angle-idx">{{ idx }}</span>
            <span class="exo-angle-val" :class="{ active: angle !== null && angle !== undefined }">
              {{ angle != null ? angle.toFixed(1) + '°' : '--' }}
            </span>
          </div>
        </div>
      </div>

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
  disablingAll, enablingAll,
  toggleRobotEngagement, showConnectionWarning, updateStatus, recalibrateMultiturn, canRecover,
  disableAllMotors, enableAllMotors,
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
  // 外骨骼
  exoskeleton_connected: false,
  exoskeleton_angles: [],
  exoskeleton_timestamp: 0,
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

// 全部禁用：点击按钮触发
async function onDisableAllClick() {
  try {
    await ElMessageBox.confirm(
      '将失能所有电机（安全停机）。\n\n电机将保持当前位置不动，需重新使能后才能运动。',
      '全部禁用',
      { confirmButtonText: '确认禁用', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return  // 用户取消
  }
  await disableAllMotors()
}

// 全部使能：点击按钮触发
async function onEnableAllClick() {
  try {
    await ElMessageBox.confirm(
      '将使能所有电机（自动扫描并注册总线上电机）。\n\n若电机离线将无法使能。',
      '全部使能',
      { confirmButtonText: '确认使能', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return  // 用户取消
  }
  await enableAllMotors()
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
    } else if (data.type === 'exo_data') {
      liveStatus.value.exoskeleton_connected = true
      liveStatus.value.exoskeleton_angles = data.joints || []
      liveStatus.value.exoskeleton_timestamp = data.timestamp || Date.now()
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

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
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

/* 外骨骼角度面板 */
.exo-panel {
  margin: 0 20px 16px 20px;
  background: rgba(26, 26, 46, 0.8);
  border: 1px solid rgba(100, 200, 255, 0.15);
  border-radius: 8px;
  padding: 10px 14px;
}

.exo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.exo-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(100, 200, 255, 0.9);
}

.exo-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.exo-angles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.exo-angle-item {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 2px 6px;
  min-width: 56px;
}

.exo-angle-idx {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  min-width: 16px;
}

.exo-angle-val {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'Courier New', monospace;

  &.active {
    color: rgba(52, 199, 89, 0.9);
    font-weight: 600;
  }
}
</style>
