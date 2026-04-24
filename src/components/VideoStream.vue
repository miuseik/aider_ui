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
    </div>
    
    <!-- 连接视频按钮 -->
    <button 
      class="connect-video-btn"
      :disabled="!isOnline"
      @click="handleConnectClick"
    >
      {{ isConnected ? '✅ 已连接' : '📹 连接视频' }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

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
let pc = null
let ws = null

// 初始化 WebRTC 连接
function initWebRTC() {
  // 先清理旧连接
  if (pc) {
    pc.close()
    pc = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
  
  // 创建 WebSocket 连接(使用唯一 ID)
  const clientId = `video_${props.videoId}_${Date.now()}`
  const fullUrl = `${props.wsUrl.split('/vr/client')[0]}/vr/client/${clientId}`
  ws = new WebSocket(fullUrl)
  
  ws.onopen = async () => {
    console.log(`[${props.videoId}] WebSocket connected`)
    
    // 发送初始化消息
    ws.send(JSON.stringify({ type: 'client' }))
    
    setupWebRTC()
  }
  
  ws.onerror = (error) => {
    console.error(`[${props.videoId}] WebSocket error:`, error)
  }
  
  ws.onclose = () => {
    console.log(`[${props.videoId}] WebSocket closed`)
    isConnected.value = false
    emit('disconnected')
  }
}

// 设置 WebRTC
function setupWebRTC() {
  console.log(`[${props.videoId}] 开始设置 WebRTC`)

  // 创建 RTCPeerConnection
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.miwifi.com:3478' },
      { urls: 'stun:stun.qq.com:3478' }
    ]
  })
  
  // 处理远程视频流
  pc.ontrack = (event) => {
    console.log(`[${props.videoId}] 收到视频轨道:`, event.track.kind)
    const video = document.getElementById(props.videoId)
    if (video && event.streams[0]) {
      video.srcObject = event.streams[0]
      console.log(`[${props.videoId}] ✅ 视频已连接`)
      isConnected.value = true
      emit('connected')
      
      // 监听视频播放状态
      video.onplay = () => {
        console.log(`[${props.videoId}] 视频开始播放`)
      }
      video.onerror = (e) => {
        console.error(`[${props.videoId}] 视频播放错误:`, e)
        isConnected.value = false
        emit('disconnected')
      }
    } else {
      console.error(`[${props.videoId}] ❌ 找不到 video 元素或没有视频流`)
      isConnected.value = false
      emit('disconnected')
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
    console.log(`[${props.videoId}] WebRTC 连接状态:`, pc.connectionState)
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      console.error(`[${props.videoId}] WebRTC 连接失败,尝试重连...`)
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
      console.log(`[${props.videoId}] Received candidate`)
    }
  }
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
</style>
