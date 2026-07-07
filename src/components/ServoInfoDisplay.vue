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
    <span v-if="loading" class="loading-text">加载中...</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as api from '@/api'
import { eventBus } from '@/utils/eventBus.js'

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

// ✅ 事件名称：servo-info-refresh-{servoId}
const eventName = computed(() => `servo-info-refresh-${props.servoId}`)

// ✅ 获取信息的函数
const fetchInfo = async () => {
  if (loading.value) return
  
  console.log('[ServoInfoDisplay] 开始获取舵机信息，ID:', props.servoId)
  loading.value = true
  try {
    const response = await api.getServoInfo(props.servoId, props.port)
    
    if (response.code === 200 && response.data) {
      console.log('[ServoInfoDisplay] 获取成功:', response.data)
      emit('update:info', response.data)
    }
  } catch (error) {
    console.error('[ServoInfoDisplay] 获取舵机信息失败:', error)
  } finally {
    loading.value = false
  }
}

// ✅ 组件挂载时监听事件
onMounted(() => {
  console.log('[ServoInfoDisplay] 组件挂载，开始监听事件:', eventName.value)
  eventBus.on(eventName.value, fetchInfo)
})

// ✅ 组件卸载时取消监听
onUnmounted(() => {
  console.log('[ServoInfoDisplay] 组件卸载，取消监听事件:', eventName.value)
  eventBus.off(eventName.value, fetchInfo)
})

// ✅ 暴露方法给父组件调用（可选）
defineExpose({
  fetchInfo
})
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
  position: absolute;
  right: 0;
}
</style>
