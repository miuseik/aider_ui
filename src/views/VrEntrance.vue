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
            <div class="video-status" v-if="!videoConnected">等待连接...</div>
            <div class="robot-label">{{ robot.name }}</div>
            <div class="status-indicator" :class="{ online: robot.online }"></div>
          </div>

          <!-- 连接视频按钮 -->
          <button
            class="connect-video-btn"
            :disabled="isConnecting || !robot.online"
            @click="connectVideo(robot)"
          >
            {{ videoConnected ? '✅ 已连接' : '📹 连接视频' }}
          </button>
          
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
const videoConnected = ref(false)

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

// 连接视频
function connectVideo(robot) {
  if (!robot || !robot.online) return

  selectedRobotId.value = robot.id

  // 如果已经连接,先断开
  if (pc) {
    pc.close()
    pc = null
  }
  if (ws) {
    ws.close()
    ws = null
  }

  // 重新初始化 WebRTC
  initWebRTC()
}

// 初始化 WebRTC 连接
function initWebRTC() {
  const SERVER_URL = import.meta.env.VITE_WS_URL || `wss://${window.location.hostname}:8442/vr/client/ui`

  // 先清理旧连接（防止热重载重复连接）
  if (pc) {
    console.log('清理旧的 RTCPeerConnection')
    pc.close()
    pc = null
  }
  if (ws) {
    ws.close()
    ws = null
  }

  // 创建 WebSocket 连接(使用唯一 ID)
  const clientId = 'entrance_' + Date.now()
  const fullUrl = `${SERVER_URL.split('/vr/client')[0]}/vr/client/${clientId}`
  ws = new WebSocket(fullUrl)

  ws.onopen = async () => {
    console.log('WebSocket connected')

    // 发送初始化消息
    ws.send(JSON.stringify({ type: 'client' }))

    setupWebRTC()
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  ws.onclose = () => {
    console.log('WebSocket closed')
  }
}

// 设置 WebRTC
function setupWebRTC() {
  console.log('WebSocket 已连接，开始设置 WebRTC')

  // 创建 RTCPeerConnection
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.miwifi.com:3478' },
      { urls: 'stun:stun.qq.com:3478' }
    ]
  })

  // 处理远程视频流
  pc.ontrack = (event) => {
    console.log('收到视频轨道:', event.track.kind)
    const robotIndex = selectedRobotId.value ? selectedRobotId.value.split('_')[1] : '01'
    const video = document.getElementById(`robot-video-${robotIndex}`)
    if (video && event.streams[0]) {
      video.srcObject = event.streams[0]
      console.log('✅ 视频已连接到 robot-video-' + robotIndex)
      videoConnected.value = true  // 标记视频已连接

      // 监听视频播放状态
      video.onplay = () => {
        console.log('视频开始播放')
      }
      video.onerror = (e) => {
        console.error('视频播放错误:', e)
        videoConnected.value = false
      }
    } else {
      console.error('❌ 找不到 video 元素或没有视频流: robot-video-' + robotIndex)
      videoConnected.value = false
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

  // 监听连接状态变化
  pc.onconnectionstatechange = () => {
    console.log('WebRTC 连接状态:', pc.connectionState)
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      console.error('WebRTC 连接失败,尝试重连...')
      // 5秒后重连
      setTimeout(() => {
        initWebRTC()
      }, 5000)
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
      console.log('Received candidate')
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

  // 延迟自动连接第一个在线机器人
  setTimeout(() => {
    const onlineRobot = robotList.value.find(r => r.online)
    if (onlineRobot) {
      connectVideo(onlineRobot)
    }
  }, 500)
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
</style>
