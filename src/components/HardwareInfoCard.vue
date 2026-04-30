<template>
  <div class="hardware-card">
    <div class="card-header">
      <h3>🔧 舵机 ID 配置</h3>
      <button @click="loadServoIds" class="refresh-btn">🔄 刷新</button>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else class="card-content">
      <!-- 左臂 -->
      <div class="arm-info">
        <div class="arm-title">左臂 ({{ servoIds.left_bus?.port || '-' }})</div>
        <div class="joints-grid">
          <div v-for="(id, name) in servoIds.left_bus?.left_arm || {}" :key="name" class="joint-tag">
            {{ getJointName(name) }}: <span class="id-value">{{ id }}</span>
          </div>
        </div>
      </div>

      <!-- 右臂 -->
      <div class="arm-info">
        <div class="arm-title">右臂 ({{ servoIds.right_bus?.port || '-' }})</div>
        <div class="joints-grid">
          <div v-for="(id, name) in servoIds.right_bus?.right_arm || {}" :key="name" class="joint-tag">
            {{ getJointName(name) }}: <span class="id-value">{{ id }}</span>
          </div>
        </div>
      </div>

      <!-- 底盘和升降轴 -->
      <div class="base-info">
        <div class="base-title">底盘 & 升降轴</div>
        <div class="base-grid">
          <div class="joint-tag">左轮: <span class="id-value">{{ servoIds.left_bus?.base?.left_wheel || '-' }}</span></div>
          <div class="joint-tag">后轮: <span class="id-value">{{ servoIds.left_bus?.base?.back_wheel || '-' }}</span></div>
          <div class="joint-tag">右轮: <span class="id-value">{{ servoIds.left_bus?.base?.right_wheel || '-' }}</span></div>
          <div class="joint-tag">升降轴: <span class="id-value">{{ servoIds.left_bus?.lift_axis || '-' }}</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const servoIds = ref({})
const loading = ref(false)

const jointNames = {
  shoulder_pan: '肩旋转',
  shoulder_lift: '肩升降',
  elbow_flex: '肘弯曲',
  wrist_flex: '腕弯曲',
  wrist_roll: '腕旋转',
  gripper: '夹爪'
}

const getJointName = (name) => {
  return jointNames[name] || name
}

const loadServoIds = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/servo-ids')
    if (response.data && response.data.data) {
      servoIds.value = response.data.data
    } else {
      servoIds.value = response.data
    }
  } catch (error) {
    console.error('加载舵机配置失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadServoIds()
})
</script>

<style scoped lang="scss">
.hardware-card {
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(100, 200, 255, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  color: white;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 16px;
      color: rgba(100, 200, 255, 0.9);
    }

    .refresh-btn {
      padding: 6px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      }
    }
  }

  .loading {
    text-align: center;
    padding: 20px;
    color: rgba(255, 255, 255, 0.6);
  }

  .card-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .arm-info, .base-info {
    .arm-title, .base-title {
      font-size: 13px;
      color: rgba(100, 200, 255, 0.8);
      margin-bottom: 8px;
      font-weight: bold;
    }
  }

  .joints-grid, .base-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .joint-tag {
    background: rgba(100, 200, 255, 0.1);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);

    .id-value {
      color: #667eea;
      font-weight: bold;
      margin-left: 4px;
    }
  }
}
</style>
