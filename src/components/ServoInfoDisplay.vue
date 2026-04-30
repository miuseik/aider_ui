<template>
  <div class="servo-info-display">
    <div class="servo-port">{{ displayPort }}</div>
    <div class="servo-details" v-if="info">
      <span>位置: {{ info.position }}</span>
      <span>角度: {{ info.angle.toFixed(1) }}°</span>
      <span>电压: {{ info.voltage }}V</span>
      <span>温度: {{ info.temperature }}°C</span>
    </div>
    <button 
      v-if="!info && !loading" 
      @click="fetchInfo"
      class="btn-fetch-info"
      title="获取舵机信息"
    >
      📋
    </button>
    <div v-if="loading" class="loading-text">加载中...</div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'

const props = defineProps({
  servoId: {
    type: Number,
    required: true
  },
  port: {
    type: String,
    default: '/dev/ttyACM0'
  },
  info: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:info'])

const loading = ref(false)

const displayPort = computed(() => {
  return props.info?.port || props.port
})

const fetchInfo = async () => {
  if (loading.value) return
  
  loading.value = true
  try {
    const response = await axios.post('/api/servo/get_info', {
      servo_id: props.servoId,
      port: props.port
    })
    
    if (response.data.code === 200 && response.data.data) {
      emit('update:info', response.data.data)
    }
  } catch (error) {
    console.error('获取舵机信息失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.servo-info-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.servo-port {
  font-size: 11px;
  color: #6b7280;
  font-family: 'JetBrains Mono', monospace;
}

.servo-details {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #9ca3af;
}

.servo-details span {
  white-space: nowrap;
}

.btn-fetch-info {
  padding: 2px 6px;
  background: #3b82f6;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
}

.btn-fetch-info:hover {
  background: #2563eb;
  transform: scale(1.05);
}

.loading-text {
  font-size: 11px;
  color: #6b7280;
  font-style: italic;
}
</style>
