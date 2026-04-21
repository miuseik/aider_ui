<template>
  <div class="calibration-page">
    <div class="header">
      <h2>🔧 电机校准</h2>
      <el-button @click="$emit('back')">返回</el-button>
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
          <li>点击对应电机的"校准零点"按钮</li>
          <li>系统自动记录偏移量并保存</li>
          <li>所有电机会在下次启动时自动应用偏移量</li>
        </ol>
      </el-alert>
    </div>
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

const emit = defineEmits(['back'])

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
