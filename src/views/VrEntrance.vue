<template>
  <div class="vr-ui-container">


    <!-- 视频流显示 -->
    <div v-if="videoFrame" class="video-overlay">
      <img :src="`data:image/jpeg;base64,${videoFrame}`" class="video-frame" />
      <div class="video-label">实时视频</div>
    </div>

    <!-- 开始跟踪按钮 -->
    <button 
      id="start-tracking-button"
      class="start-button"
      :disabled="isConnecting"
      @click="handleStartTracking"
    >
      {{ buttonText }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import VideoStreamManager from '../utils/videoStream.js'

const router = useRouter()
const emit = defineEmits(['vr-entered'])

const isVRMode = ref(false)
const isConnecting = ref(false)

// 视频流
const videoFrame = ref('')
let videoStream = null

// 按钮文本
const buttonText = computed(() => {
  if (isConnecting.value) return '连接中...'
  return '开始控制器跟踪'
})

// 处理开始跟踪
async function handleStartTracking() {
  isConnecting.value = true
  
  try {
    // 检查机械臂状态
    const statusResponse = await fetch('/api/status')
    const status = await statusResponse.json()
    console.log(status)
    if (!status.robotEngaged) {
      // 连接机械臂
      const connectResponse = await fetch('/api/robot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      })
      const connectResult = await connectResponse.json()
      
      if (!connectResult.success) {
        throw new Error(connectResult.error || '无法连接机器人机械臂')
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // 直接跳转到 VrScene 页面
    router.push('/vr-scene')
  } catch (err) {
    alert(`启动失败: ${err.message}`)
  } finally {
    isConnecting.value = false
  }
}

// 监听 VR 进入/退出事件
function setupVREventListeners() {
  const sceneEl = document.querySelector('a-scene')
  if (!sceneEl) return
  
  sceneEl.addEventListener('enter-vr', () => {
    isVRMode.value = true
    emit('vr-entered')  // 通知父组件
  })
  
  sceneEl.addEventListener('exit-vr', () => {
    isVRMode.value = false
  })
}

onMounted(() => {
  setupVREventListeners()
  
  // 初始化视频流
  videoStream = new VideoStreamManager()
  videoStream.onFrameUpdate = (frame) => {
    videoFrame.value = frame
  }
  videoStream.connect()
})

onUnmounted(() => {
  // 清理视频流
  if (videoStream) {
    videoStream.disconnect()
  }
})
</script>

<style scoped>
.vr-ui-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9998;
}

.instructions-content {
  display: flex;
  gap: 15px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.image-section {
  flex: 1;
  min-width: 150px;
  text-align: center;
}

.image-section img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.text-section {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}

.instruction-item {
  padding: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 6px;
}

.grip-text {
  color: #ee4d9a;
}

.trigger-text {
  color: #9af58c;
}

.start-button {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 20px 40px;
  font-size: 20px;
  font-weight: bold;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}

.start-button:disabled {
  background-color: #666;
  cursor: not-allowed;
}

.video-overlay {
  width: 320px;
  height: 240px;
  border: 3px solid #0f0;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.8);
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
}

.video-frame {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-label {
  position: absolute;
  top: 5px;
  left: 5px;
  background: rgba(0, 0, 0, 0.7);
  color: #0f0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}
</style>
