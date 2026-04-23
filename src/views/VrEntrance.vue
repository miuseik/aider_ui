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
          <div class="video-container" @click="selectRobot(robot)">
            <video 
              :id="`robot-video-${robot.id.split('_')[1]}`"
              autoplay 
              playsinline
              class="robot-video"
            />
            <div class="robot-label">{{ robot.name }}</div>
            <div class="status-indicator" :class="{ online: robot.online }"></div>
          </div>
          
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

const router = useRouter()
const emit = defineEmits(['vr-entered'])

const isVRMode = ref(false)
const isConnecting = ref(false)
const selectedRobotId = ref(null)

// 模拟多机器人列表（后期从 API 获取）
const robotList = ref([
  { id: 'robot_01', name: 'Aloha Mini #1', online: true },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_03', name: 'SO100 #1', online: false }
])

// WebRTC 相关
let pc = null
let ws = null

// 按钮文本
const buttonText = computed(() => {
  if (isConnecting.value) return '连接中...'
  if (!selectedRobotId.value) return '请选择机器人'
  return '开始控制器跟踪'
})

// 选择机器人
function selectRobot(robot) {
  selectedRobotId.value = robot.id
}

// 初始化 WebRTC 连接
function initWebRTC() {
  const SERVER_URL = import.meta.env.VITE_WS_URL || `wss://${window.location.hostname}:8442/ws`
  
  // 创建 WebSocket 连接
  ws = new WebSocket(SERVER_URL)
  
  ws.onopen = async () => {
    console.log('WebSocket connected')
    
    // 发送初始化消息
    ws.send(JSON.stringify({ type: 'client' }))
    
    // 创建 RTCPeerConnection
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.miwifi.com:3478' },
        { urls: 'stun:stun.qq.com:3478' }
      ]
    })
    
    // 处理远程视频流
    pc.ontrack = (event) => {
      const video = document.getElementById('robot-video-01')
      if (video) {
        video.srcObject = event.streams[0]
        console.log('视频连接成功')
      }
    }
    
    // 处理 ICE 候选
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: 'candidate',
          candidate: event.candidate
        }))
      }
    }
    
    // 监听信令消息
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data))
        
        // 创建 answer
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        // 发送 answer
        ws.send(JSON.stringify({
          type: 'answer',
          sdp: pc.localDescription.sdp
        }))
      } else if (data.type === 'candidate') {
        // ICE 候选由浏览器自动处理
        console.log('Received candidate')
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    ws.onclose = () => {
      console.log('WebSocket closed')
    }
  }
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
  
  // 初始化 WebRTC 视频接收
  initWebRTC()
})

onUnmounted(() => {
  // 清理 WebRTC 连接
  if (pc) {
    pc.close()
    pc = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
})
</script>

<style scoped lang="scss">
.vr-ui-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9998;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

/* 机器人网格布局 */
.robot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
  width: 100%;
  max-width: 1400px;
  margin-bottom: 40px;
  pointer-events: auto;
}

.robot-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
  }

  &.selected {
    border-color: #00ff88;
    box-shadow: 0 0 30px rgba(0, 255, 136, 0.5);
  }
}

.video-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: #000;
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
</style>
