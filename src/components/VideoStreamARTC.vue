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
      
      <!-- Loading 动画 -->
      <div v-if="joining" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ loadingText }}</div>
      </div>
      
      <div class="video-status" v-if="!isConnected && !joining && !isOnline">等待连接...</div>
      <div class="robot-label">{{ label }}</div>
      <div class="status-indicator" :class="{ online: isOnline }"></div>
      
      <!-- 播放按钮（居中） -->
      <button 
        v-if="!joining && !isConnected"
        class="play-btn play-btn-center"
        :disabled="!isOnline"
        @click.stop="handleConnectClick"
      >
        ▶️
      </button>
      
      <!-- 暂停按钮（右下角） -->
      <button 
        v-if="isConnected"
        class="play-btn play-btn-corner"
        @click.stop="handleConnectClick"
      >
        ⏸
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { wsClient } from '../utils/websocket.js'
import AliRtcEngine from 'aliyun-rtc-sdk'  // 使用npm安装的SDK（官方包名）

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
const loadingText = ref('连接中...')
let aliRtcEngine = null
let connectStartTime = null
let countdownTimer = null

// Token 生成（完整 base64 JSON，同 AliRTCEngine.GenerateToken 格式）
async function generateToken(appId, appKey, channelId, userId, timestamp) {
  const combined = `${appId}${appKey}${channelId}${userId}${timestamp}`
  const data = new TextEncoder().encode(combined)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const sha256Hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')

  const payload = {
    appid: appId,
    channelid: channelId,
    userid: userId,
    nonce: '',
    timestamp,
    token: sha256Hex,
  }
  return btoa(JSON.stringify(payload))
}

// 初始化 ARTC 连接
async function initARTC() {
  if (joining.value || isConnected.value) return
  
  console.log(`[${props.videoId}] 🚀 开始连接视频...`)
  joining.value = true
  stopSent = false
  connectStartTime = Date.now()
  
  // 启动倒计时更新
  updateLoadingText()
  
  try {
    // 1. 先通知后端启动视频推流（通过 WebSocket）
    const cmd = {
      type: 'api_command',
      category: 'video',
      action: 'start'
    }
    wsClient.send(JSON.stringify(cmd))
    console.log(`[${props.videoId}] 📹 已发送启动视频推流请求`)
    
    // 2. 等待后端启动推流
    console.log(`[${props.videoId}] ⏳ 等待后端推流启动...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 3. 使用npm安装的SDK
    console.log(`[${props.videoId}] ✅ 使用 npm 安装的 ARTC SDK`)
    
    aliRtcEngine = AliRtcEngine.getInstance()
    
    // isSupported 在 VR 浏览器上可能误报，跳过检测，直接连接

    // 设置自动订阅（重要：必须用 setDefaultSubscribeAll*）
    console.log(`[${props.videoId}] ⚡ 配置自动订阅...`)
    try {
      if (aliRtcEngine.setDefaultSubscribeAllRemoteVideoStreams) {
        aliRtcEngine.setDefaultSubscribeAllRemoteVideoStreams(true)
        console.log(`[${props.videoId}] ✅ 默认订阅远端视频已启用`)
      }
      if (aliRtcEngine.setDefaultSubscribeAllRemoteAudioStreams) {
        aliRtcEngine.setDefaultSubscribeAllRemoteAudioStreams(true)
      }
    } catch(e) {
      console.warn(`[${props.videoId}] ⚠️ 自动订阅配置失败:`, e.message)
    }

    // 设置互动模式
    aliRtcEngine.setChannelProfile('interactive_live')
    aliRtcEngine.setClientRole('interactive')
    
    // 注册事件
    registerEvents()
    
    // 生成完整 base64 Token（同 Python GenerateToken 格式）
    const userId = `web_viewer_${props.videoId}`
    const timestamp = Math.floor(Date.now() / 1000) + 86400
    const fullToken = await generateToken(props.appId, props.appKey, props.channelId, userId, timestamp)
    console.log(`[${props.videoId}] 🔑 Token generated (base64 JSON)`)
    
    // 使用单字符串方式 joinChannel（与 demo 验证通过的方案一致）
    console.log(`[${props.videoId}] 🔗 加入频道...`)
    const joinStart = Date.now()
    
    try {
      await aliRtcEngine.joinChannel(fullToken, userId)
      const joinTime = ((Date.now() - joinStart) / 1000).toFixed(2)
      console.log(`[${props.videoId}] ✅ 加入频道成功，耗时: ${joinTime}s`)
    } catch (err) {
      console.error(`[${props.videoId}] ❌ 加入频道失败:`, err)
      joining.value = false
      ElMessage.error(`加入频道失败: ${err.message}`)
      return
    }
    
    // 加入成功后开始检测
    console.log(`[${props.videoId}] ⚡ 开始检测视频...`)

    startTrackPolling()
    
    // VR浏览器加速：高频快速检测（前10秒每200ms检查）
    let fastCheckCount = 0
    const fastCheckTimer = setInterval(() => {
      fastCheckCount++
      const video = document.getElementById(props.videoId)
      if (!video || isConnected.value) {
        clearInterval(fastCheckTimer)
        return
      }
      
      video.muted = true
      video.play().catch(() => {})
      
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const elapsed = ((Date.now() - connectStartTime) / 1000).toFixed(1)
        isConnected.value = true
        joining.value = false
        emit('connected')
        clearInterval(fastCheckTimer)
        if (countdownTimer) clearInterval(countdownTimer)
        console.log(`[${props.videoId}] 🎬 视频连接成功！耗时: ${elapsed}s`)
      }
      
      if (fastCheckCount >= 50) {
        clearInterval(fastCheckTimer)
        console.log(`[${props.videoId}] ⚠️ 快速检测超时（10秒）`)
      }
    }, 200)
    
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
      // 元素不存在时重试（最长等 1 秒）
      let attempts = 0
      const retry = () => {
        const v = document.getElementById(props.videoId)
        if (v) { doBind(v, userId, tag) }
        else if (attempts++ < 10) { setTimeout(retry, 100) }
      }
      setTimeout(retry, 100)
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

  // 显式订阅（同 demo 验证通过的方案）
  try { aliRtcEngine.subscribeRemoteMediaStream?.(userId, 1, true, true) } catch(e) {}
  try { aliRtcEngine.subscribe?.(userId, 'video') } catch(e) {}
  try { aliRtcEngine.subscribeRemoteUserVideo?.(userId) } catch(e) {}
  try { aliRtcEngine.subscribe?.({ userId: userId, video: true }) } catch(e) {}

  // setRemoteViewConfig
  try {
    aliRtcEngine.setRemoteViewConfig(video, userId, 1)
  } catch(e) {}

  // 延时 play + 多次重试
  setTimeout(function() { tryPlay(video, tag) }, 200)
  setTimeout(function() { tryPlay(video, tag) }, 800)
  setTimeout(function() { tryPlay(video, tag) }, 2000)
  setTimeout(function() { tryPlay(video, tag) }, 5000)
}

// 注册事件
function registerEvents() {
  if (!aliRtcEngine) return

  // 远端上线
  aliRtcEngine.on('remoteUserOnLineNotify', (userId) => {
    try { tryBindVideo(userId, 'v6') } catch(e) {}
  })

  // 远端音视频轨道可用 → 显式订阅（同 demo 方案）
  aliRtcEngine.on('remoteTrackAvailableNotify', (userId, audioTrack, videoTrack) => {
    try {
      aliRtcEngine.subscribeRemoteMediaStream?.(userId, 1, !!videoTrack, !!audioTrack)
    } catch(e) {}
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
      try { aliRtcEngine.setRemoteViewConfig(null, userId, 1) } catch(e) {}
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
      try { aliRtcEngine.setRemoteViewConfig?.(v, userId, 1) } catch(e) {}
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

// ---------- 主动轮询 ----------
let pollTimer = null
function startTrackPolling() {
  if (pollTimer) return
  let tries = 0
  console.log(`[${props.videoId}] 🔁 开始轮询检测...`)
  pollTimer = setInterval(() => {
    tries++
    const video = document.getElementById(props.videoId)
    if (!video) return

    if (isConnected.value && video.readyState >= 2 && !video.paused) {
      clearInterval(pollTimer); pollTimer = null
      return
    }

    try {
      const users = aliRtcEngine.getRemoteUsers?.() || aliRtcEngine.getUsers?.() || []
      if (tries <= 5 || tries % 10 === 0) {
        console.log(`[${props.videoId}] 🔍 第${tries}次轮询，检测到远端用户:`, users)
      }
      for (const uid of users) {
        const userId = typeof uid === 'string' ? uid : uid.userId || uid.id
        if (tries <= 5 || tries % 10 === 0) {
          console.log(`[${props.videoId}] 📡 尝试订阅用户:`, userId)
        }
        // 不管是谁，全部订阅！
        try { aliRtcEngine.subscribe?.(userId, 'video') } catch(e) {}
        try { aliRtcEngine.subscribeRemoteUserVideo?.(userId) } catch(e) {}
        try { aliRtcEngine.setRemoteViewConfig(video, userId, 1) } catch(e) {}
      }
    } catch(e) {}

    video.muted = true
    video.play().catch(() => {})
    
    if (video.readyState >= 2 && video.videoWidth > 0 && !isConnected.value) {
      const elapsed = ((Date.now() - connectStartTime) / 1000).toFixed(1)
      isConnected.value = true
      joining.value = false
      emit('connected')
      console.log(`[${props.videoId}] 🎬 轮询检测到视频！耗时: ${elapsed}s (第${tries}次)`)
    }

    if (tries > 60) { 
      clearInterval(pollTimer); pollTimer = null
      console.warn(`[${props.videoId}] ❌ 轮询超时（30秒，共${tries}次）`)
    }
  }, 500)
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
    video.muted = true
    video.play().catch(() => {})
    if (attempts > 15) { clearInterval(videoCheckTimer); videoCheckTimer = null }
  }, 500)
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
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
  
  wasConnected = isConnected.value
  isConnected.value = false
  joining.value = false
  
  if (wasConnected) {
    wsClient.send(JSON.stringify({
      type: 'api_command',
      category: 'video',
      action: 'stop'
    }))
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

// 更新 loading 文本（显示已等待时间）
function updateLoadingText() {
  if (countdownTimer) clearInterval(countdownTimer)
  
  countdownTimer = setInterval(() => {
    if (!joining.value || isConnected.value) {
      clearInterval(countdownTimer)
      return
    }
    
    const elapsed = Math.floor((Date.now() - connectStartTime) / 1000)
    loadingText.value = `连接中 ${elapsed}s`
  }, 1000)
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

// 播放按钮基础样式
.play-btn {
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  
  &:hover:not(:disabled) {
    background: rgba(0, 255, 136, 0.8);
    border-color: #00ff88;
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

// 居中的播放按钮
.play-btn-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  font-size: 24px;
  z-index: 5;
  
  &:hover:not(:disabled) {
    transform: translate(-50%, -50%) scale(1.1);
  }
}

// 右下角的暂停按钮
.play-btn-corner {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  font-size: 18px;
  z-index: 5;
  
  &:hover:not(:disabled) {
    background: rgba(255, 68, 68, 0.9);
    border-color: #ff4444;
    transform: scale(1.1);
  }
}

// Loading 动画样式
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 10;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #00ff88;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
</style>
