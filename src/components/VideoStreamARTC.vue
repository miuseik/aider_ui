<template>
  <div class="video-wrapper">
    <div class="video-container" @click="$emit('click')">
      <video 
        :id="videoId"
        autoplay 
        playsinline
        muted
        class="robot-video"
      />
      <div class="video-status" v-if="!isConnected">等待连接...</div>
      <div class="robot-label">{{ label }}</div>
      <div class="status-indicator" :class="{ online: isOnline }"></div>
      
      <!-- 播放/暂停按钮 -->
      <button 
        class="play-btn"
        :class="{ 'playing': isConnected }"
        :disabled="!isOnline || joining"
        @click.stop="handleConnectClick"
      >
        {{ isConnected ? '⏸' : (joining ? '⏳' : '▶️') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { wsClient } from '../utils/websocket.js'  // 移到顶层

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
  // ARTC 配置
  appId: {
    type: String,
    default: '1295a524-ff41-4bfc-ba3f-7c1c786738cd'
  },
  appKey: {
    type: String,
    default: '659fe17ceb1494befefd57559b094a0d'
  },
  channelId: {
    type: String,
    default: 'test123'
  },
  terminalUserId: {
    type: String,
    default: 'python_terminal'
  }
})

const emit = defineEmits(['click', 'connected', 'disconnected'])

const isConnected = ref(false)
const joining = ref(false)
let aliRtcEngine = null

// Token 生成
function hex(buffer) {
  const hexCodes = []
  const view = new DataView(buffer)
  for (let i = 0; i < view.byteLength; i += 4) {
    const value = view.getUint32(i)
    const stringValue = value.toString(16)
    const padding = '00000000'
    const paddedValue = (padding + stringValue).slice(-padding.length)
    hexCodes.push(paddedValue)
  }
  return hexCodes.join('')
}

async function generateToken(appId, appKey, channelId, userId, timestamp) {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${appId}${appKey}${channelId}${userId}${timestamp}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return hex(hash)
}

// 动态加载 SDK
function loadSDK() {
  return new Promise((resolve, reject) => {
    if (window.AliRtcEngine) return resolve()
    
    const script = document.createElement('script')
    script.src = 'https://g.alicdn.com/apsara-media-box/imp-web-rtc/7.1.9/aliyun-rtc-sdk.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('SDK 加载失败'))
    document.head.appendChild(script)
  })
}

// 初始化 ARTC 连接
async function initARTC() {
  if (joining.value || isConnected.value) return
  
  joining.value = true
  stopSent = false  // 重置停止标志
  
  try {
    // 1. 先通知后端启动视频推流（通过 WebSocket）
    const cmd = {
      type: 'api_command',
      category: 'video',
      action: 'start'
    }
    wsClient.send(JSON.stringify(cmd))
    console.log(`[${props.videoId}] 📹 已发送启动视频推流请求到后端`)
    
    // 2. 等待一小段时间让后端启动推流
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 3. 加载 SDK
    if (!window.AliRtcEngine) {
      await loadSDK()
    }
    
    aliRtcEngine = window.AliRtcEngine.getInstance()
    
    // isSupported 在 VR 浏览器上可能误报，跳过检测，直接连接

    // 设置互动模式
    aliRtcEngine.setChannelProfile('interactive_live')
    aliRtcEngine.setClientRole('interactive')
    
    // 注册事件
    registerEvents()
    
    // 生成 Token
    const userId = `web_viewer_${props.videoId}`
    const timestamp = Math.floor(Date.now() / 1000) + 3600
    const token = await generateToken(props.appId, props.appKey, props.channelId, userId, timestamp)
    
    // 加入频道
    await aliRtcEngine.joinChannel({
      appId: props.appId,
      channelId: props.channelId,
      userId,
      token,
      timestamp,
    }, userId)
    
    console.log(`[${props.videoId}] ✅ ARTC 加入频道成功`)

    // 启动主动轮询获取远程视频
    startTrackPolling()
    
  } catch (error) {
    console.error(`[${props.videoId}] ❌ ARTC 连接失败:`, error)
    ElMessage.error(`连接失败: ${error.message}`)
    joining.value = false
  }
}

// 独立的核心绑定函数
function tryBindVideo(userId, tag) {
  try {
    const video = document.getElementById(props.videoId)
    if (!video) {
      setTimeout(() => {
        const v = document.getElementById(props.videoId)
        if (v) doBind(v, userId, tag)
      }, 300)
      return
    }
    doBind(video, userId, tag)
  } catch(e) {}
}

function tryPlay(video, tag) {
  try {
    video.muted = true
    var p = video.play()
    if (p && typeof p.then === 'function') {
      var settled = false
      p.then(function() {
        settled = true
        if (video.videoWidth > 0 && !isConnected.value) {
          isConnected.value = true; joining.value = false; emit('connected')
        }
      }).catch(function(e) {
        settled = true
      })
      // Quest 上 Promise 可能永不 settle，超时兜底
      setTimeout(function() {
        if (!settled && video.readyState >= 1 && !isConnected.value) {
          isConnected.value = true; joining.value = false; emit('connected')
        }
      }, 2000)
    } else {
      if (video.readyState >= 1 && !isConnected.value) {
        isConnected.value = true; joining.value = false; emit('connected')
      }
    }
  } catch(e) {}
}

function doBind(video, userId, tag) {
  video.muted = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')

  // 多种订阅
  try { aliRtcEngine.subscribe?.(userId, 'video') } catch(e) {}
  try { aliRtcEngine.subscribeRemoteUserVideo?.(userId) } catch(e) {}
  try { aliRtcEngine.subscribe?.({ userId: userId, video: true }) } catch(e) {}

  // setRemoteViewConfig
  try {
    aliRtcEngine.setRemoteViewConfig(video, userId, 1)
  } catch(e) {}

  // 延时 play + 多次重试（Quest 上需要等 SDK 内部渲染管初始化）
  setTimeout(function() { tryPlay(video, tag) }, 500)
  setTimeout(function() { tryPlay(video, tag) }, 3000)
  setTimeout(function() { tryPlay(video, tag) }, 10000)
}

// 注册事件
function registerEvents() {
  if (!aliRtcEngine) return

  // 远端上线
  aliRtcEngine.on('remoteUserOnLineNotify', (userId) => {
    try { tryBindVideo(userId, 'v6') } catch(e) {}
  })

  // 远端下线
  aliRtcEngine.on('remoteUserOffLineNotify', (userId) => {
    if (userId === props.terminalUserId || userId.includes(props.videoId)) {
      disconnect()
    }
  })

  // 视频订阅状态
  aliRtcEngine.on('videoSubscribeStateChanged', (userId, oldState, newState) => {
    if (newState === 3) {
      tryBindVideo(userId, 'sub')
      if (!isConnected.value) { isConnected.value = true; joining.value = false }
    } else if (newState === 1) {
      try { aliRtcEngine.setRemoteViewConfig(null, userId, 1) } catch {}
      if (userId === props.terminalUserId || userId.includes(props.videoId)) disconnect()
    }
    startVideoHealthCheck()
  })

  // v7 事件
  aliRtcEngine.on('user-published', (userId) => { tryBindVideo(userId, 'v7') })
  aliRtcEngine.on('user-unpublished', (userId) => {
    if (userId === props.terminalUserId || userId.includes(props.videoId)) disconnect()
  })

  // track 订阅
  aliRtcEngine.on('track-subscribed', (userId, track) => {
    if (track?.kind === 'video' && track?.readyState === 'live') {
      const v = document.getElementById(props.videoId)
      if (!v) return
      v.muted = true
      try { aliRtcEngine.setRemoteViewConfig?.(v, userId, 1) } catch {}
      setTimeout(() => {
        v.muted = true
        v.play().catch(() => {})
        if (v.videoWidth > 0 && !isConnected.value) {
          isConnected.value = true; joining.value = false; emit('connected')
        }
      }, 300)
    }
  })
}

// ---------- 主动轮询（Quest 浏览器上事件可能不触发） ----------
let pollTimer = null
function startTrackPolling() {
  if (pollTimer) return
  let tries = 0
  pollTimer = setInterval(() => {
    tries++
    const video = document.getElementById(props.videoId)
    if (!video) return

    // 已连上且有画面，停
    if (isConnected.value && video.readyState >= 2 && !video.paused) {
      clearInterval(pollTimer); pollTimer = null
      return
    }

    // 从 SDK 拿远程用户，订阅并设置 rvc
    try {
      const users = aliRtcEngine.getRemoteUsers?.() || aliRtcEngine.getUsers?.() || []
      for (const uid of users) {
        const userId = typeof uid === 'string' ? uid : uid.userId || uid.id
        if (userId && userId.includes('terminal')) {
          try { aliRtcEngine.subscribe?.(userId, 'video') } catch(e) {}
          try { aliRtcEngine.subscribeRemoteUserVideo?.(userId) } catch(e) {}
          try { aliRtcEngine.setRemoteViewConfig(video, userId, 1) } catch(e) {}
        }
      }
    } catch(e) {}

    video.play().catch(() => {})

    if (tries > 30) { clearInterval(pollTimer); pollTimer = null }
  }, 1500)
}

// ---------- 视频健康检查 ----------
let videoCheckTimer = null
function startVideoHealthCheck() {
  if (videoCheckTimer) return
  let attempts = 0
  videoCheckTimer = setInterval(() => {
    attempts++
    const video = document.getElementById(props.videoId)
    if (!video || !isConnected.value) {
      if (attempts > 10) { clearInterval(videoCheckTimer); videoCheckTimer = null }
      return
    }
    if (video.readyState >= 2 && !video.paused) {
      clearInterval(videoCheckTimer); videoCheckTimer = null
      return
    }
    video.play().catch(() => {})
    if (attempts > 15) { clearInterval(videoCheckTimer); videoCheckTimer = null }
  }, 1500)
}

// 断开连接
let stopSent = false  // 防止重复发送 stop
let wasConnected = false  // 追踪是否真正连接过

function disconnect() {
  // 防止重复调用
  if (stopSent) return
  stopSent = true

  // 清理定时器
  if (videoCheckTimer) { clearInterval(videoCheckTimer); videoCheckTimer = null }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  
  // 记录是否真的连接过
  wasConnected = isConnected.value
  isConnected.value = false
  joining.value = false
  
  // 只有在真正连接成功后才发送停止命令
  if (wasConnected) {
    // 通知后端停止视频推流（通过 WebSocket）
    const cmd = {
      type: 'api_command',
      category: 'video',
      action: 'stop'
    }
    wsClient.send(JSON.stringify(cmd))
    console.log(`[${props.videoId}] 📹 已发送停止视频推流请求到后端`)
  } else {
    console.log(`[${props.videoId}] 未连接，不发送停止命令`)
  }
  
  if (aliRtcEngine) {
    try {
      aliRtcEngine.stopPreview()
      aliRtcEngine.leaveChannel()
      aliRtcEngine.destroy()
    } catch (e) {
      console.error(`[${props.videoId}] 清理出错:`, e)
    }
    aliRtcEngine = null
  }
  
  emit('disconnected')
}

// 处理按钮点击
function handleConnectClick() {
  console.log(`[${props.videoId}] 点击连接按钮, 当前状态:`, isConnected.value)
  
  if (isConnected.value) {
    // 如果已连接，则断开（暂停）
    console.log(`[${props.videoId}] 断开连接（暂停视频）...`)
    disconnect()
  } else if (!joining.value) {
    // 如果未连接且未在连接中，则开始连接
    console.log(`[${props.videoId}] 开始连接...`)
    initARTC()
  }
}

// 暴露方法给父组件
defineExpose({
  connect: initARTC,
  disconnect,
  isConnected
})

onMounted(() => {
  // 不自动连接，等待用户点击
})

onUnmounted(() => {
  disconnect()
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
  
  // 播放状态下的样式
  &.playing {
    background: rgba(255, 136, 0, 0.8);
    border-color: #ff8800;
    
    &:hover:not(:disabled) {
      background: rgba(255, 68, 68, 0.9);
      border-color: #ff4444;
    }
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
</style>
