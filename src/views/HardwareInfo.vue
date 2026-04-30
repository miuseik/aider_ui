<template>
  <div class="hardware-info">
    <div class="header">
      <h2>🔧 硬件信息 - 舵机 ID 配置</h2>
      <button @click="loadServoIds" class="refresh-btn">🔄 刷新状态</button>
    </div>
    
    <div class="robot-body">
      <!-- 头部/脖子（升降轴） -->
      <div class="head-section">
        <div class="joint-card lift-axis">
          <div class="joint-label">升降轴</div>
          <div class="joint-id">{{ servoIds.left_bus.lift_axis }}</div>
        </div>
      </div>

      <!-- 身体（底盘） -->
      <div class="body-section">
        <div class="chassis">
          <div class="joint-card wheel left-wheel">
            <div class="joint-label">左轮</div>
            <div class="joint-id">{{ servoIds.left_bus.base.left_wheel }}</div>
          </div>
          <div class="joint-card wheel back-wheel">
            <div class="joint-label">后轮</div>
            <div class="joint-id">{{ servoIds.left_bus.base.back_wheel }}</div>
          </div>
          <div class="joint-card wheel right-wheel">
            <div class="joint-label">右轮</div>
            <div class="joint-id">{{ servoIds.left_bus.base.right_wheel }}</div>
          </div>
        </div>
      </div>

      <!-- 左臂 -->
      <div class="arm-section left-arm">
        <h3>左臂 ({{ servoIds.left_bus.port }})</h3>
        <div class="joints-list">
          <div v-for="(id, name) in servoIds.left_bus.left_arm" :key="name" class="joint-item">
            <span class="joint-name">{{ getJointName(name) }}</span>
            <span class="joint-id-badge">{{ id }}</span>
          </div>
        </div>
      </div>

      <!-- 右臂 -->
      <div class="arm-section right-arm">
        <h3>右臂 ({{ servoIds.right_bus.port }})</h3>
        <div class="joints-list">
          <div v-for="(id, name) in servoIds.right_bus.right_arm" :key="name" class="joint-item">
            <span class="joint-name">{{ getJointName(name) }}</span>
            <span class="joint-id-badge">{{ id }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="config-info">
      <h3>📝 配置说明</h3>
      <ul>
        <li>根据实际接线修改串口号 (port)</li>
        <li>使用 detect_servos.py 扫描确认每个舵机的实际 ID</li>
        <li>如果 ID 不匹配，用工具重新设置舵机 ID</li>
        <li>底盘和升降轴必须接在左臂总线上</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const servoIds = ref({
  left_bus: {
    port: '',
    left_arm: {},
    base: {},
    lift_axis: 0
  },
  right_bus: {
    port: '',
    right_arm: {}
  }
})

const jointNames = {
  shoulder_pan: '肩关节旋转',
  shoulder_lift: '肩关节升降',
  elbow_flex: '肘关节弯曲',
  wrist_flex: '腕关节弯曲',
  wrist_roll: '腕关节旋转',
  gripper: '夹爪'
}

const getJointName = (name) => {
  return jointNames[name] || name
}

const loadServoIds = async () => {
  try {
    const response = await axios.get('/api/servo-ids')
    console.log('舵机配置响应:', response.data)
    // API 返回格式: { code: 200, data: {...}, message: "success" }
    if (response.data && response.data.data) {
      servoIds.value = response.data.data
    } else {
      servoIds.value = response.data
    }
  } catch (error) {
    console.error('加载舵机配置失败:', error)
  }
}

onMounted(async () => {
  await loadServoIds()
})
</script>

<style scoped lang="scss">
.hardware-info {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;

    h2 {
      margin: 0;
      color: #333;
    }

    .refresh-btn {
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: transform 0.2s, box-shadow 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }

  h2 {
    text-align: center;
    margin-bottom: 30px;
    color: #333;
  }

  .robot-body {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    grid-template-rows: auto auto;
    gap: 20px;
    margin-bottom: 30px;

    .head-section {
      grid-column: 2;
      grid-row: 1;
      display: flex;
      justify-content: center;

      .lift-axis {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        min-width: 120px;
      }
    }

    .body-section {
      grid-column: 2;
      grid-row: 2;
      display: flex;
      justify-content: center;

      .chassis {
        display: flex;
        gap: 15px;
        align-items: center;

        .wheel {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          min-width: 100px;

          &.back-wheel {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          }
        }
      }
    }

    .arm-section {
      grid-row: 1 / span 2;

      &.left-arm {
        grid-column: 1;
      }

      &.right-arm {
        grid-column: 3;
      }

      h3 {
        color: #555;
        margin-bottom: 15px;
        font-size: 16px;
      }

      .joints-list {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .joint-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 4px solid #667eea;

          .joint-name {
            color: #333;
            font-size: 14px;
          }

          .joint-id-badge {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 14px;
          }
        }
      }
    }
  }

  .config-info {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 8px;
    padding: 20px;

    h3 {
      color: #856404;
      margin-bottom: 15px;
    }

    ul {
      color: #856404;
      padding-left: 20px;

      li {
        margin-bottom: 8px;
        line-height: 1.6;
      }
    }
  }
}

.joint-card {
  .joint-label {
    font-size: 12px;
    opacity: 0.9;
    margin-bottom: 5px;
  }

  .joint-id {
    font-size: 24px;
    font-weight: bold;
  }
}
</style>
