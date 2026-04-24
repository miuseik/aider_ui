 <template>
  <Layout>
    <div class="vr-ui-container">
      <!-- 多机器人视频网格 -->
      <div class="robot-grid">
        <div 
          v-for="robot in robotList" 
          :key="robot.id"
          class="robot-card"
          :class="{ selected: selectedRobotId === robot.id }"
        >
          <VideoStream
            :video-id="`robot-video-${robot.id.split('_')[1]}`"
            :label="robot.name"
            :is-online="robot.online"
            :ws-url="WS_URL"
            @click="selectRobot(robot)"
            @connected="handleVideoConnected(robot.id)"
            @disconnected="handleVideoDisconnected(robot.id)"
          />
          
          <!-- 每个机器人的进入按钮 -->
          <button 
            class="enter-vr-btn"
            :disabled="isConnecting || !robot.online"
            @click="handleStartTracking(robot)"
          >
            {{ isConnecting && selectedRobotId === robot.id ? '连接中...' : '进入 VR' }}
          </button>
        </div>
      </div>
    </div>
  </Layout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import Layout from '../components/Layout.vue'
import VideoStream from '../components/VideoStream.vue'

const router = useRouter()
const emit = defineEmits(['vr-entered'])

const isVRMode = ref(false)
const isConnecting = ref(false)
const selectedRobotId = ref(null)
const connectedVideos = ref(new Set())

// WebSocket URL
const WS_URL = import.meta.env.VITE_WS_URL || `wss://${window.location.hostname}:8442/vr/client/ui`

// 模拟多机器人列表（后期从 API 获取）
const robotList = ref([
  { id: 'robot_01', name: 'Aloha Mini #1', online: true },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_03', name: 'SO100 #1', online: false }
])

// 选择机器人
function selectRobot(robot) {
  selectedRobotId.value = robot.id
}

// 视频连接成功
function handleVideoConnected(robotId) {
  connectedVideos.value.add(robotId)
  console.log(`✅ ${robotId} 视频已连接`)
}

// 视频断开连接
function handleVideoDisconnected(robotId) {
  connectedVideos.value.delete(robotId)
  console.log(`❌ ${robotId} 视频已断开`)
}

// 处理开始跟踪
async function handleStartTracking(robot) {
  if (!robot || !robot.id) return
  
  // 先选择该机器人
  selectedRobotId.value = robot.id
  
  isConnecting.value = true
  
  try {
    // 直接跳转到 VrScene 页面
    await new Promise(resolve => setTimeout(resolve, 300))
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
})

onUnmounted(() => {
  // 组件卸载时不需要清理,VideoStream 组件会自己清理
})
</script>

<style scoped lang="scss">
.vr-ui-container {
  position: fixed;
  top: 60px;
  left: 0;
  width: 100vw;
  height: calc(100vh - 60px);
  pointer-events: none;
  z-index: 9998;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 40px;
  overflow-y: auto;
}

/* 自定义滚动条样式 */
.vr-ui-container::-webkit-scrollbar {
  width: 8px;
}

.vr-ui-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.vr-ui-container::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 136, 0.3);
  border-radius: 4px;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 255, 136, 0.5);
  }
}

.vr-ui-container::-webkit-scrollbar-thumb:active {
  background: rgba(0, 255, 136, 0.7);
}

/* 机器人网格布局 - 响应式自适应 */
.robot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  width: 100%;
  max-width: 1600px;
  pointer-events: auto;
}

.robot-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  height: auto;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 255, 136, 0.2);
    border-color: rgba(0, 255, 136, 0.3);
  }

  &.selected {
    border-color: #00ff88;
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
  }
}

.video-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: #000;
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

.video-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%);
}

.placeholder-text {
  color: rgba(255, 255, 255, 0.3);
  font-size: 18px;
  font-weight: bold;
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

/* 连接视频按钮 */
.connect-video-btn {
  width: 100%;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  pointer-events: auto;
  margin-top: 8px;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
  }

  &:disabled {
    background: linear-gradient(135deg, #666 0%, #444 100%);
    cursor: not-allowed;
    opacity: 0.5;
  }
}

/* 进入VR按钮 */
.enter-vr-btn {
  width: 100%;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  pointer-events: auto;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #00cc6a 0%, #00994f 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: linear-gradient(135deg, #666 0%, #444 100%);
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.start-button {
  padding: 20px 60px;
  font-size: 20px;
  font-weight: bold;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background-color: #45a049;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.4);
  }

  &:disabled {
    background-color: #666;
    cursor: not-allowed;
    opacity: 0.6;
  }
}

/* 临时测试区域 */
.test-area {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 12px;
  border: 2px solid #00ff88;
  pointer-events: auto;
  z-index: 9999;
}
</style>
