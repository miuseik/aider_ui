<template>
  <div class="calibration-page">
    <div class="header">
      <h2>⚙️ 点击设置</h2>
    </div>

    <el-row :gutter="20" class="content">
      <!-- 左机械臂 -->
      <el-col :xs="24" :sm="12" :lg="8">
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
              <div class="motor-info">
                <span class="motor-name">{{ motor.label }}</span>
                <span class="motor-angle">{{ motorAngles[`left_${motor.name}`] || 0 }}°</span>
              </div>
              <el-slider 
                v-model="motorAngles[`left_${motor.name}`]"
                :min="-180"
                :max="180"
                :step="0.1"
                @change="(val) => controlMotor('left', motor.name, val)"
              />
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
      </el-col>

      <!-- 右机械臂 -->
      <el-col :xs="24" :sm="12" :lg="8">
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
              <div class="motor-info">
                <span class="motor-name">{{ motor.label }}</span>
                <span class="motor-angle">{{ motorAngles[`right_${motor.name}`] || 0 }}°</span>
              </div>
              <el-slider 
                v-model="motorAngles[`right_${motor.name}`]"
                :min="-180"
                :max="180"
                :step="0.1"
                @change="(val) => controlMotor('right', motor.name, val)"
              />
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
      </el-col>

      <!-- 底盘和升降轴 -->
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card class="arm-card">
          <template #header>
            <div class="card-header">
              <span>移动底盘 & 升降轴</span>
            </div>
          </template>

          <div class="motor-list">
            <!-- 左轮 -->
            <div class="motor-item">
              <div class="motor-info">
                <span class="motor-name">左轮</span>
                <span class="motor-speed">{{ chassisSpeed.left || 0 }}%</span>
              </div>
              <el-slider 
                v-model="chassisSpeed.left"
                :min="-100"
                :max="100"
                :step="1"
                @change="(val) => controlChassis('left', val)"
              />
              <div class="direction-controls">
                <el-button size="small" @click="setDirection('left', -1)">◀ 反转</el-button>
                <el-button size="small" @click="setDirection('left', 1)">前进 ▶</el-button>
              </div>
            </div>
            
            <!-- 后轮 -->
            <div class="motor-item">
              <div class="motor-info">
                <span class="motor-name">后轮</span>
                <span class="motor-speed">{{ chassisSpeed.rear || 0 }}%</span>
              </div>
              <el-slider 
                v-model="chassisSpeed.rear"
                :min="-100"
                :max="100"
                :step="1"
                @change="(val) => controlChassis('rear', val)"
              />
              <div class="direction-controls">
                <el-button size="small" @click="setDirection('rear', -1)">◀ 反转</el-button>
                <el-button size="small" @click="setDirection('rear', 1)">前进 ▶</el-button>
              </div>
            </div>
            
            <!-- 右轮 -->
            <div class="motor-item">
              <div class="motor-info">
                <span class="motor-name">右轮</span>
                <span class="motor-speed">{{ chassisSpeed.right || 0 }}%</span>
              </div>
              <el-slider 
                v-model="chassisSpeed.right"
                :min="-100"
                :max="100"
                :step="1"
                @change="(val) => controlChassis('right', val)"
              />
              <div class="direction-controls">
                <el-button size="small" @click="setDirection('right', -1)">◀ 反转</el-button>
                <el-button size="small" @click="setDirection('right', 1)">前进 ▶</el-button>
              </div>
            </div>
            
            <!-- 升降轴 -->
            <div class="motor-item">
              <div class="motor-info">
                <span class="motor-name">升降轴</span>
                <span class="motor-speed">{{ liftSpeed || 0 }}%</span>
              </div>
              <el-slider 
                v-model="liftSpeed"
                :min="-100"
                :max="100"
                :step="1"
                @change="(val) => controlLift(val)"
              />
              <div class="direction-controls">
                <el-button size="small" @click="setLiftDirection(-1)">▼ 下降</el-button>
                <el-button size="small" @click="setLiftDirection(1)">上升 ▲</el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 操作说明 -->
      <el-col :span="24">
        <el-alert
          title="校准步骤"
          type="info"
          :closable="false"
          style="margin-top: 20px"
        >
          <ol style="margin: 10px 0; padding-left: 20px">
            <li>手动将机械臂移动到零点位置</li>
            <li>点击对应电机的"校准零点"按钮</li>
            <li>系统自动记录偏移量并保存</li>
            <li>所有电机会在下次启动时自动应用偏移量</li>
          </ol>
        </el-alert>
        
        <div style="margin-top: 16px; text-align: center;">
          <el-button type="primary" size="large" @click="$emit('switch-vr')">
            <el-icon><Monitor /></el-icon>
            机器人列表
          </el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const props = defineProps({
  status: {
    type: Object,
    required: true
  }
})

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

// 电机角度状态
const motorAngles = ref({})

// 底盘速度状态
const chassisSpeed = ref({
  left: 0,
  rear: 0,
  right: 0
})

// 升降轴速度
const liftSpeed = ref(0)

// 校准状态
const calibrating = ref({})

// 控制电机角度
async function controlMotor(arm, motorName, angle) {
  try {
    await axios.post('/api/control_motor', {
      arm,
      motor: motorName,
      angle: angle
    })
  } catch (error) {
    console.error(`控制电机失败: ${error.message}`)
  }
}

// 控制底盘速度
async function controlChassis(wheel, speed) {
  try {
    await axios.post('/api/control_chassis', {
      wheel,
      speed: speed
    })
  } catch (error) {
    console.error(`控制底盘失败: ${error.message}`)
  }
}

// 设置底盘方向
async function setDirection(wheel, direction) {
  const currentSpeed = chassisSpeed.value[wheel] || 0
  if (currentSpeed === 0) {
    ElMessage.warning('请先调整速度滑块')
    return
  }
  // 使用当前滑块的速度，只改变方向
  const speed = direction * Math.abs(currentSpeed)
  await controlChassis(wheel, speed)
}

// 控制升降轴
async function controlLift(speed) {
  try {
    await axios.post('/api/control_lift', {
      speed: speed
    })
  } catch (error) {
    console.error(`控制升降轴失败: ${error.message}`)
  }
}

// 设置升降轴方向
async function setLiftDirection(direction) {
  const currentSpeed = liftSpeed.value || 0
  if (currentSpeed === 0) {
    ElMessage.warning('请先调整速度滑块')
    return
  }
  // 使用当前滑块的速度，只改变方向
  const speed = direction * Math.abs(currentSpeed)
  await controlLift(speed)
}

// 校准电机
async function calibrateMotor(arm, motorName) {
  const key = `${arm}_${motorName}`
  calibrating.value[key] = true
  
  try {
    await axios.post('/api/calibrate', {
      arm,
      motor: motorName,
      target_zero: 0.0
    })
    
    ElMessage.success(`${arm === 'left' ? '左' : '右'}机械臂 ${motorName} 校准成功`)
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
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 20px;
  
  h2 {
    margin: 0;
  }
}

.content {
  width: 100%;
}

.arm-card {
  height: 100%;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.motor-list {
  .motor-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    
    &:last-child {
      border-bottom: none;
    }
    
    .motor-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .motor-name {
        font-size: 14px;
        color: var(--el-text-color-regular);
      }
      
      .motor-angle,
      .motor-speed {
        font-size: 13px;
        color: var(--el-color-primary);
        font-weight: 600;
      }
    }
    
    .direction-controls {
      display: flex;
      gap: 8px;
      justify-content: center;
      
      .el-button {
        flex: 1;
      }
    }
  }
}
</style>
