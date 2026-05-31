<template>
  <div class="terminal-video-page">
    <!-- 连接配置面板 -->
    <el-card class="config-card" v-if="!joined">
      <template #header>
        <div class="card-header">
          <span class="card-title">📡 RTC 连接配置</span>
        </div>
      </template>

      <el-form :model="config" label-position="top" size="default">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="AppID">
              <el-input v-model="config.appId" placeholder="输入 AppID" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="AppKey">
              <el-input v-model="config.appKey" type="password" placeholder="输入 AppKey" show-password />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="频道号">
              <el-input v-model="config.channelId" placeholder="频道号" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="用户ID">
              <el-input v-model="config.userId" placeholder="用户ID" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="终端用户ID (订阅远端)">
              <el-input v-model="config.terminalUserId" placeholder="终端用户ID" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item>
          <el-button type="primary" @click="joinChannel" :loading="joining" size="large" style="width: 100%">
            {{ joining ? '加入频道中...' : '加入频道' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 视频显示区域 -->
    <div class="video-section" v-if="joined">
      <div class="video-toolbar">
        <el-tag :type="connectionState === 'connected' ? 'success' : 'warning'" effect="dark" size="large">
          {{ connectionStateText }}
        </el-tag>
        <div class="toolbar-info">
          <span>频道: {{ config.channelId }}</span>
          <span class="divider">|</span>
          <span>用户: {{ config.userId }}</span>
          <span class="divider">|</span>
          <span>远端: {{ config.terminalUserId }}</span>
        </div>
        <el-button type="danger" @click="leaveChannel" :loading="leaving" size="small">
          离开频道
        </el-button>
      </div>

      <!-- 远端视频（全屏宽度，始终在 DOM 中以便 SDK 绑定） -->
      <div class="video-grid">
        <div class="video-item remote-video" v-show="remoteSubscribed">
          <div class="video-label">
            <span class="label-badge">远端</span>
            终端视频 - {{ config.terminalUserId }}
          </div>
          <video
            id="remoteVideo"
            autoplay
            playsinline
            muted
            class="video-element"
          ></video>
        </div>
      </div>

      <!-- 无远端流时占位 -->
      <div class="no-remote" v-if="!remoteSubscribed">
        <el-empty description="等待终端推流..." />
        <p class="hint-text">请确保终端已启动 RTC 推流</p>
      </div>
    </div>

    <!-- 日志 -->
    <el-card class="log-card" v-if="logs.length > 0">
      <template #header>
        <span>📋 事件日志</span>
        <el-button size="small" style="float: right" @click="logs = []">清空</el-button>
      </template>
      <div class="log-list">
        <div v-for="(log, i) in logs" :key="i" class="log-item" :class="log.type">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-msg">{{ log.msg }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

// ---------- 配置 ----------
const config = reactive({
  appId: '1295a524-ff41-4bfc-ba3f-7c1c786738cd',
  appKey: '659fe17ceb1494befefd57559b094a0d',
  channelId: 'test123',
  userId: 'web_viewer_' + Math.random().toString(36).slice(2, 8),
  terminalUserId: 'python_terminal',
})

const joining = ref(false)
const leaving = ref(false)
const joined = ref(false)
const remoteSubscribed = ref(false)
const connectionState = ref('idle') // idle | connecting | connected | disconnected
const logs = ref([])

let aliRtcEngine = null

const connectionStateText = computed(() => {
  const map = {
    idle: '未连接',
    connecting: '连接中...',
    connected: '已连接',
    disconnected: '已断开',
  }
  return map[connectionState.value] || connectionState.value
})

function addLog(msg, type = 'info') {
  const now = new Date().toLocaleTimeString()
  logs.value.unshift({ time: now, msg, type })
  if (logs.value.length > 50) logs.value.pop()
}

// ---------- Token 生成 (仅供测试，生产环境请走服务端) ----------
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

// ---------- 加入频道 ----------
async function joinChannel() {
  if (!config.appId || !config.appKey || !config.channelId) {
    ElMessage.warning('请填写 AppID、AppKey 和频道号')
    return
  }

  joining.value = true
  connectionState.value = 'connecting'
  addLog(`正在加入频道 ${config.channelId}...`)

  try {
    // 动态加载 SDK (避免阻塞首页)
    if (!window.AliRtcEngine) {
      await loadSDK()
    }

    aliRtcEngine = window.AliRtcEngine.getInstance()
    addLog('SDK 实例已创建')

    // 检查环境
    const checkResult = await window.AliRtcEngine.isSupported()
    if (!checkResult.support) {
      throw new Error('当前浏览器不支持 ARTC')
    }
    addLog('浏览器环境检测通过')

    // 注册事件
    registerEvents()

    // 设置互动模式
    aliRtcEngine.setChannelProfile('interactive_live')
    aliRtcEngine.setClientRole('interactive')

    // 生成 Token
    const timestamp = Math.floor(Date.now() / 1000) + 3600
    const token = await generateToken(config.appId, config.appKey, config.channelId, config.userId, timestamp)

    // 加入频道
    await aliRtcEngine.joinChannel({
      appId: config.appId,
      channelId: config.channelId,
      userId: config.userId,
      token,
      timestamp,
    }, config.userId)

    addLog('✅ 加入频道成功', 'success')
    joined.value = true
    connectionState.value = 'connected'
    ElMessage.success('加入频道成功')

    // 不开启本地预览，仅观看远端视频
    addLog('等待终端远端视频...')

  } catch (error) {
    addLog(`❌ 加入失败: ${error.message}`, 'error')
    connectionState.value = 'idle'
    ElMessage.error('加入频道失败: ' + error.message)
  } finally {
    joining.value = false
  }
}

// ---------- 离开频道 ----------
async function leaveChannel() {
  leaving.value = true
  addLog('正在离开频道...')

  try {
    if (aliRtcEngine) {
      await aliRtcEngine.stopPreview()
      await aliRtcEngine.leaveChannel()
      aliRtcEngine.destroy()
      aliRtcEngine = null
    }
    addLog('已离开频道')
  } catch (e) {
    addLog(`离开频道出错: ${e.message}`, 'warn')
  }

  joined.value = false
  remoteSubscribed.value = false
  connectionState.value = 'idle'
  leaving.value = false
  ElMessage.info('已离开频道')
}

// ---------- 事件注册 ----------
function registerEvents() {
  if (!aliRtcEngine) return

  aliRtcEngine.off('bye')
  aliRtcEngine.off('remoteUserOnLineNotify')
  aliRtcEngine.off('remoteUserOffLineNotify')
  aliRtcEngine.off('videoSubscribeStateChanged')
  aliRtcEngine.off('audioSubscribeStateChanged')
  aliRtcEngine.off('authInfoExpired')

  // 被踢出
  aliRtcEngine.on('bye', (code) => {
    addLog(`❌ 被踢出频道, 原因码: ${code}`, 'error')
    connectionState.value = 'disconnected'
    remoteSubscribed.value = false
  })

  // 远端上线
  aliRtcEngine.on('remoteUserOnLineNotify', (userId) => {
    addLog(`👤 远端用户上线: ${userId}`)
  })

  // 远端下线
  aliRtcEngine.on('remoteUserOffLineNotify', (userId) => {
    addLog(`👋 远端用户下线: ${userId}`)
    if (userId === config.terminalUserId) {
      remoteSubscribed.value = false
    }
  })

  // 视频订阅状态
  aliRtcEngine.on('videoSubscribeStateChanged', (userId, oldState, newState) => {
    addLog(`📹 视频订阅 [${userId}]: ${oldState} → ${newState}`)
    if (newState === 3) {
      // 已订阅
      const video = document.getElementById('remoteVideo')
      if (video) {
        aliRtcEngine.setRemoteViewConfig(video, userId, 1)
        addLog(`✅ 远端视频已就绪: ${userId}`, 'success')
        if (userId === config.terminalUserId) {
          remoteSubscribed.value = true
        }
      }
    } else if (newState === 1) {
      // 未订阅
      aliRtcEngine.setRemoteViewConfig(null, userId, 1)
      addLog(`远端视频已断开: ${userId}`)
      if (userId === config.terminalUserId) {
        remoteSubscribed.value = false
      }
    }
  })

  // 音频订阅状态
  aliRtcEngine.on('audioSubscribeStateChanged', (userId, oldState, newState) => {
    if (newState === 3) {
      addLog(`🔊 远端音频已就绪: ${userId}`)
    }
  })

  // 鉴权过期
  aliRtcEngine.on('authInfoExpired', () => {
    addLog('⚠️ 鉴权已过期', 'warn')
  })
}

// ---------- 动态加载 SDK ----------
function loadSDK() {
  return new Promise((resolve, reject) => {
    if (window.AliRtcEngine) return resolve()

    const script = document.createElement('script')
    script.src = 'https://g.alicdn.com/apsara-media-box/imp-web-rtc/7.1.9/aliyun-rtc-sdk.js'
    script.onload = () => {
      addLog('ARTC SDK 加载完成')
      resolve()
    }
    script.onerror = () => {
      reject(new Error('SDK 加载失败'))
    }
    document.head.appendChild(script)
  })
}

// ---------- 清理 ----------
onUnmounted(() => {
  if (aliRtcEngine) {
    try {
      aliRtcEngine.stopPreview()
      aliRtcEngine.leaveChannel()
      aliRtcEngine.destroy()
    } catch (e) { /* ignore */ }
    aliRtcEngine = null
  }
})
</script>

<style scoped lang="scss">
.terminal-video-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 120px);
}

// ---------- 配置卡片 ----------
.config-card {
  max-width: 700px;
  margin: 60px auto 0;
  background: rgba(26, 26, 46, 0.85) !important;
  border: 1px solid rgba(100, 200, 255, 0.2) !important;
  backdrop-filter: blur(10px);

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-title {
    font-size: 18px;
    font-weight: bold;
    color: #00ff88;
  }
}

// ---------- 视频区域 ----------
.video-section {
  margin-top: 20px;
}

.video-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: rgba(26, 26, 46, 0.9);
  border: 1px solid rgba(100, 200, 255, 0.2);
  border-radius: 8px;
  margin-bottom: 20px;

  .toolbar-info {
    flex: 1;
    color: rgba(200, 220, 255, 0.9);
    font-size: 13px;

    .divider {
      margin: 0 8px;
      color: rgba(100, 200, 255, 0.4);
    }
  }
}

.video-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.video-item {
  background: #000;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(100, 200, 255, 0.25);
  position: relative;

  .video-label {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;

    .label-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      background: rgba(0, 255, 136, 0.2);
      color: #00ff88;
      border: 1px solid rgba(0, 255, 136, 0.5);

      &.local {
        background: rgba(100, 200, 255, 0.2);
        color: #64c8ff;
        border-color: rgba(100, 200, 255, 0.5);
      }
    }
  }

  .video-element {
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
    display: block;
    background: #111;
  }
}

.no-remote {
  text-align: center;
  padding: 60px 20px;
  background: rgba(26, 26, 46, 0.5);
  border-radius: 10px;
  border: 1px dashed rgba(100, 200, 255, 0.2);

  .hint-text {
    color: rgba(200, 220, 255, 0.6);
    font-size: 14px;
  }
}

// ---------- 日志 ----------
.log-card {
  margin-top: 20px;
  background: rgba(26, 26, 46, 0.85) !important;
  border: 1px solid rgba(100, 200, 255, 0.2) !important;
  max-height: 300px;

  :deep(.el-card__body) {
    max-height: 220px;
    overflow-y: auto;
  }
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-item {
  display: flex;
  gap: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Courier New', monospace;

  &.success { color: #00ff88; }
  &.warn { color: #ffaa00; }
  &.error { color: #ff5555; }
  &.info { color: rgba(200, 220, 255, 0.8); }

  .log-time {
    color: rgba(150, 180, 220, 0.6);
    white-space: nowrap;
    min-width: 80px;
  }

  .log-msg {
    flex: 1;
  }
}
</style>
