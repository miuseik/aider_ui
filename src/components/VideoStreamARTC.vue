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
      
      <!-- 播放按钮 -->
      <button 
        class="play-btn"
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
  
  try {
    // 加载 SDK
    if (!window.AliRtcEngine) {
      await loadSDK()
    }
    
    aliRtcEngine = window.AliRtcEngine.getInstance()
    
    // 检查环境
    const checkResult = await window.AliRtcEngine.isSupported()
    if (!checkResult.support) {
      throw new Error('当前浏览器不支持 ARTC')
    }
    
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
    
  } catch (error) {
    console.error(`[${props.videoId}] ❌ ARTC 连接失败:`, error)
    ElMessage.error(`连接失败: ${error.message}`)
    joining.value = false
  }
}

// 注册事件
function registerEvents() {
  if (!aliRtcEngine) return
  
  // 远端上线
  aliRtcEngine.on('remoteUserOnLineNotify', (userId) => {
    console.log(`[${props.videoId}] 👤 远端用户上线: ${userId}`)
  })
  
  // 远端下线
  aliRtcEngine.on('remoteUserOffLineNotify', (userId) => {
    console.log(`[${props.videoId}] 👋 远端用户下线: ${userId}`)
    if (userId === props.terminalUserId) {
      disconnect()
    }
  })
  
  // 视频订阅状态
  aliRtcEngine.on('videoSubscribeStateChanged', (userId, oldState, newState) => {
    console.log(`[${props.videoId}] 📹 视频订阅 [${userId}]: ${oldState} → ${newState}`)
    
    if (newState === 3) { // 已订阅
      const video = document.getElementById(props.videoId)
      if (video) {
        aliRtcEngine.setRemoteViewConfig(video, userId, 1)
        console.log(`[${props.videoId}] ✅ 远端视频已就绪: ${userId}`)
        
        if (userId === props.terminalUserId) {
          isConnected.value = true
          joining.value = false
          emit('connected')
        }
      }
    } else if (newState === 1) { // 未订阅
      aliRtcEngine.setRemoteViewConfig(null, userId, 1)
      if (userId === props.terminalUserId) {
        disconnect()
      }
    }
  })
}

// 断开连接
function disconnect() {
  isConnected.value = false
  joining.value = false
  
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
  if (!isConnected.value && !joining.value) {
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
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
</style>
