<template>
  <div class="calibration-page">
    <div class="header">
      <h2>🔧 电机校准</h2>
      <div class="header-actions">
        <el-button icon="Setting" @click="openSettings">⚙️ 系统设置</el-button>
        <el-button @click="$router.push('/')">返回</el-button>
      </div>
    </div>

    <div class="content">
      <!-- 左机械臂 -->
      <el-card class="arm-card">
        <template #header>
          <div class="card-header">
            <span>左机械臂</span>
            <el-tag :type="status.left_arm_connected ? 'success' : 'danger'">
              {{ status.left_arm_connected ? '已连接' : '未连接' }}
            </el-tag>
          </div>
        </template>

        <div class="motor-list">
          <div v-for="(motor, index) in leftMotors" :key="motor.name" class="motor-item">
            <span class="motor-name">{{ motor.label }}</span>
            <el-button 
              size="small" 
              type="primary"
              :loading="calibrating[motor.name]"
              @click="calibrateMotor('left', motor.name)"
            >
              校准零点
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- 右机械臂 -->
      <el-card class="arm-card">
        <template #header>
          <div class="card-header">
            <span>右机械臂</span>
            <el-tag :type="status.right_arm_connected ? 'success' : 'danger'">
              {{ status.right_arm_connected ? '已连接' : '未连接' }}
            </el-tag>
          </div>
        </template>

        <div class="motor-list">
          <div v-for="motor in rightMotors" :key="motor.name" class="motor-item">
            <span class="motor-name">{{ motor.label }}</span>
            <el-button 
              size="small" 
              type="primary"
              :loading="calibrating[motor.name]"
              @click="calibrateMotor('right', motor.name)"
            >
              校准零点
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- 底盘和升降轴 -->
      <el-card class="arm-card">
        <template #header>
          <div class="card-header">
            <span>移动底盘 & 升降轴</span>
          </div>
        </template>

        <div class="motor-list">
          <div class="motor-item">
            <span class="motor-name">左轮</span>
            <el-button size="small" type="primary" disabled>速度模式无需校准</el-button>
          </div>
          <div class="motor-item">
            <span class="motor-name">后轮</span>
            <el-button size="small" type="primary" disabled>速度模式无需校准</el-button>
          </div>
          <div class="motor-item">
            <span class="motor-name">右轮</span>
            <el-button size="small" type="primary" disabled>速度模式无需校准</el-button>
          </div>
          <div class="motor-item">
            <span class="motor-name">升降轴</span>
            <el-button size="small" type="primary" disabled>速度模式无需校准</el-button>
          </div>
        </div>
      </el-card>

      <!-- 操作说明 -->
      <el-alert
        title="校准步骤"
        type="info"
        :closable="false"
        style="margin-top: 20px"
      >
        <ol style="margin: 10px 0; padding-left: 20px">
          <li>手动将机械臂移动到零点位置</li>
          <li>点击对应电机的“校准零点”按钮</li>
          <li>系统自动记录偏移量并保存</li>
          <li>所有电机会在下次启动时自动应用偏移量</li>
        </ol>
      </el-alert>
    </div>

    <!-- 系统设置对话框 -->
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { useRobot } from '@/composables/useRobot'
import { useConfig } from '@/composables/useConfig'
import SettingsModal from '@/components/SettingsModal.vue'

const router = useRouter()

const { status, updateStatus } = useRobot()
const { config, saving, restarting, sendIntervalMs, loadConfiguration, saveConfiguration, restartSystem } = useConfig()

// 设置对话框状态
const settingsVisible = ref(false)

// 打开设置
function openSettings() {
  settingsVisible.value = true
  loadConfiguration()
}

// 关闭设置
function closeSettings() {
  settingsVisible.value = false
}

// 电机列表
const leftMotors = [
  { name: 'shoulder_pan', label: '肩部旋转' },
  { name: 'shoulder_lift', label: '肩部升降' },
  { name: 'elbow_flex', label: '肘部弯曲' },
  { name: 'wrist_flex', label: '腕部弯曲' },
  { name: 'wrist_roll', label: '腕部旋转' },
  { name: 'gripper', label: '夹爪' }
]

const rightMotors = [...leftMotors]

// 校准状态
const calibrating = ref({})

// 舵机 ID 配置（从 /get-servo-ids 加载）
const servoIdsConfig = ref(null)

// 页面加载时获取状态和舵机配置
onMounted(async () => {
  updateStatus()
  try {
    const res = await axios.post('/api/get-servo-ids', { role: 'aider' })
    servoIdsConfig.value = res.data?.data ?? null
  } catch { /* 非关键，配置可选 */ }
})

// 从 arm+motor 解析出 servo_id + port
function resolveServoInfo(arm, motorName) {
  const config = servoIdsConfig.value
  if (!config) return null
  const armConfig = config[`${arm}_arm`] || config[arm]
  if (!armConfig) return null
  const motor = armConfig[motorName]
  if (!motor) return null
  return { servo_id: motor.id, port: motor.port || 'can0' }
}

// 校准电机零点（统一调用 /servo/calibrate）
async function calibrateMotor(arm, motorName) {
  const key = `${arm}_${motorName}`
  calibrating.value[key] = true

  try {
    const info = resolveServoInfo(arm, motorName)
    if (!info) {
      ElMessage.warning(`未找到 ${arm}_${motorName} 的舵机配置`)
      return
    }

    const res = await axios.post('/api/servo/calibrate', {
      servo_id: info.servo_id,
      port: info.port
    })

    if (res.data?.code === 200) {
      ElMessage.success(`${arm === 'left' ? '左' : '右'}机械臂 ${motorName} 零点已设置`)
    } else {
      ElMessage.error(`校准失败: ${res.data?.message || '未知错误'}`)
    }
  } catch (error) {
    ElMessage.error(`校准失败: ${error.message}`)
  } finally {
    calibrating.value[key] = false
  }
}
</script>

<style lang="scss" scoped>
.calibration-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h2 {
    margin: 0;
  }
  
  .header-actions {
    display: flex;
    gap: 10px;
  }
}

.content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

.arm-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.motor-list {
  .motor-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    
    &:last-child {
      border-bottom: none;
    }
    
    .motor-name {
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }
}
</style>
