<template>
  <div class="video-wrapper">
    <div class="video-container" @click="$emit('click')">
      <video 
        :id="videoId"
        autoplay 
        playsinline
        class="robot-video"
      />
      <div class="video-status" v-if="!isConnected">等待连接...</div>
      <div class="robot-label">{{ label }}</div>
      <div class="status-indicator" :class="{ online: isOnline }"></div>
      
      <!-- 连接类型指示 -->
      <div class="connection-type" v-if="isConnected && connectionType">
        {{ connectionType }}
      </div>
      
      <!-- 播放按钮 - 左下角 -->
      <button 
        class="play-btn"
        :disabled="!isOnline"
        @click.stop="handleConnectClick"
      >
        {{ isConnected ? '⏸' : '▶️' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { WebRTCVideoManager } from '../utils/webRTCManager'

const props = defineProps({
  videoId: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  wsUrl: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['click', 'connected', 'disconnected'])

const isConnected = ref(false)
const connectionType = ref('')
let manager = null

// 初始化 WebRTC 连接
function initWebRTC() {
  manager = new WebRTCVideoManager({
    videoId: props.videoId,
    wsUrl: props.wsUrl,
    onConnected: (type) => {
      isConnected.value = true
      connectionType.value = type || ''
      emit('connected')
    },
    onDisconnected: () => {
      isConnected.value = false
      connectionType.value = ''
      emit('disconnected')
    },
    onError: (error) => {
      console.error(`[${props.videoId}] Error:`, error)
    }
  })
  
  manager.init()
}

// 手动触发连接
function connect() {
  initWebRTC()
}

// 处理按钮点击
function handleConnectClick() {
  console.log(`[${props.videoId}] 点击连接按钮, 当前状态:`, isConnected.value)
  if (!isConnected.value) {
    console.log(`[${props.videoId}] 开始连接...`)
    connect()
  } else {
    console.log(`[${props.videoId}] 已经连接,忽略点击`)
  }
}

// 暴露方法给父组件
defineExpose({
  connect,
  isConnected
})

onMounted(() => {
  // 不自动连接,等待用户点击按钮
})

onUnmounted(() => {
  // 清理 WebRTC 连接
  if (manager) {
    manager.cleanup()
    manager = null
  }
})
</script>

<style scoped lang="scss">
.video-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.video-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: #000;
  cursor: pointer;
}

.video-status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
  pointer-events: none;
}

.robot-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.robot-label {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: bold;
}

.status-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff4444;
  box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);

  &.online {
    background: #00ff88;
    box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
  }
}

.connection-type {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #00ff88;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.play-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  
  &:hover:not(:disabled) {
    background: rgba(0, 255, 136, 0.8);
    border-color: #00ff88;
    transform: scale(1.1);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
</style>
