<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted, nextTick } from 'vue'
import { artcManager, ChannelState, type RemoteUserInfo, type LogEntry, type ARTCConfig } from '../utils/artcManager'
import { ARTC_CONFIG } from '../config/artc'

// ============ Config Form ============
const form = reactive<ARTCConfig>({
  appId: ARTC_CONFIG.appId,
  channelId: ARTC_CONFIG.channelId,
  userId: ARTC_CONFIG.userId,
  userName: ARTC_CONFIG.userName,
})

// ============ State ============
const channelState = ref<ChannelState>(ChannelState.IDLE)
const remoteUsers = ref<RemoteUserInfo[]>([])
const logs = ref<LogEntry[]>([])

// ============ Video Elements（在 manager 内统一管理）============

// ============ Computed ============
const isIdle = computed(() => channelState.value === ChannelState.IDLE)
const isJoining = computed(() => channelState.value === ChannelState.JOINING)
const isJoined = computed(() => channelState.value === ChannelState.JOINED)
const isLeaving = computed(() => channelState.value === ChannelState.LEAVING)
const hasError = computed(() => channelState.value === ChannelState.ERROR)

const stateLabel = computed(() => {
  switch (channelState.value) {
    case ChannelState.IDLE: return '未连接'
    case ChannelState.JOINING: return '加入中...'
    case ChannelState.JOINED: return '已连接'
    case ChannelState.LEAVING: return '离开中...'
    case ChannelState.ERROR: return '错误'
    default: return ''
  }
})

const stateClass = computed(() => {
  switch (channelState.value) {
    case ChannelState.JOINED: return 'state-joined'
    case ChannelState.ERROR: return 'state-error'
    case ChannelState.JOINING:
    case ChannelState.LEAVING: return 'state-loading'
    default: return 'state-idle'
  }
})

const subscribedUsers = computed(() =>
  remoteUsers.value.filter((u) => u.videoSubState === 3)
)



// ============ Actions ============
async function handleJoin() {
  try {
    await artcManager.initialize()
    await artcManager.joinChannel({ ...form })
  } catch {
    // Error handled by manager events
  }
}

async function handleLeave() {
  await artcManager.leaveChannel()
}

// ============ Lifecycle ============
artcManager.onStateChange((s) => {
  channelState.value = s
})

artcManager.onRemoteUsersChange((users) => {
  remoteUsers.value = users
})

artcManager.onLog((entry) => {
  logs.value = [...logs.value, entry].slice(-100)
})

onUnmounted(() => {
  artcManager.destroy()
})
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <h1>🎥 ARTC 实时视频通信</h1>
      <div class="status-bar">
        <span :class="['status-dot', stateClass]"></span>
        <span>{{ stateLabel }}</span>
        <span v-if="isJoined" class="user-count">
          | 在线用户: {{ remoteUsers.length }}
        </span>
      </div>
    </header>

    <!-- Main Content -->
    <div class="main">
      <!-- Left: Config Panel -->
      <aside class="panel config-panel">
        <h2>⚙ 频道配置</h2>

        <label>App ID</label>
        <input v-model="form.appId" placeholder="your-app-id" :disabled="!isIdle" />

        <label>Channel ID</label>
        <input v-model="form.channelId" placeholder="test123" :disabled="!isIdle" />

        <label>User ID</label>
        <input v-model="form.userId" placeholder="web_user" :disabled="!isIdle" />

        <label>User Name</label>
        <input v-model="form.userName" placeholder="Web User" :disabled="!isIdle" />

        <div class="btn-group">
          <button
            v-if="isIdle || hasError"
            class="btn btn-primary"
            @click="handleJoin"
            :disabled="!form.appId || !form.channelId || !form.userId"
          >
            🚀 加入频道
          </button>
          <button
            v-else-if="isJoined"
            class="btn btn-danger"
            @click="handleLeave"
          >
            🛑 离开频道
          </button>
          <button
            v-else
            class="btn btn-disabled"
            disabled
          >
            ⏳ {{ isJoining ? '加入中...' : '离开中...' }}
          </button>
        </div>
      </aside>

      <!-- Right: Video Area -->
      <section class="video-area">
        <!-- Remote Streams -->
        <div class="video-card" style="flex:1">
          <h3>
            🌐 远端视频 ({{ subscribedUsers.length }}/{{ remoteUsers.length }})
          </h3>
          <div class="remote-grid">
            <div
              v-for="user in remoteUsers"
              :key="user.uid"
              class="remote-item"
              :class="{ subscribed: user.videoSubState === 3 }"
            >
              <div class="video-wrapper remote-wrapper">
                <video
                  :ref="(el: any) => artcManager.registerVideoElement(user.uid, el as HTMLVideoElement | null)"
                  autoplay
                  muted
                  playsinline
                  class="video-elem"
                  :class="{ 'video-hidden': user.videoSubState !== 3 }"
                ></video>
                <div v-if="user.videoSubState !== 3" class="video-placeholder">
                  <span v-if="user.videoSubState === 2">
                    ⏳ 订阅中...
                  </span>
                  <span v-else>
                    📡 {{ user.hasVideo ? '等待订阅' : '无视频' }}
                  </span>
                </div>
              </div>
              <div class="remote-label">{{ user.uid }}</div>
            </div>
            <div v-if="remoteUsers.length === 0" class="no-remote">
              <span>{{ isJoined ? '⏳ 等待远端用户上线...' : '🔒 加入频道后显示' }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Log Panel -->
    <footer class="log-panel">
      <h3>📋 日志</h3>
      <div class="log-list" ref="logContainer">
        <div v-for="(log, idx) in logs" :key="idx" class="log-entry">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
/* ========== Global Reset ========== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: #0f1923;
  color: #e0e0e0;
  min-height: 100vh;
}

#app {
  width: 100%;
  max-width: 100%;
}
</style>

<style scoped>
/* ========== Layout ========== */
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #0a1628 0%, #0f1923 100%);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header h1 {
  font-size: 1.4rem;
  font-weight: 600;
  color: #fff;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #9ca3af;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6b7280;
}

.state-joined {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.state-error {
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
}

.state-loading {
  background: #f59e0b;
  animation: pulse 1s infinite;
}

.user-count {
  color: #22c55e;
}

/* ========== Main Layout ========== */
.main {
  display: flex;
  flex: 1;
  gap: 16px;
  padding: 16px 32px;
  min-height: 0;
}

/* ========== Config Panel ========== */
.config-panel {
  width: 280px;
  flex-shrink: 0;
}

.panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 20px;
}

.panel h2 {
  font-size: 1.1rem;
  margin-bottom: 16px;
  color: #fff;
}

.config-panel label {
  display: block;
  font-size: 0.8rem;
  color: #9ca3af;
  margin-bottom: 4px;
  margin-top: 12px;
}

.config-panel input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  color: #e0e0e0;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.config-panel input:focus {
  border-color: #3b82f6;
}

.config-panel input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-group {
  margin-top: 20px;
}

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
}

.btn-danger:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.btn-disabled {
  background: rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  cursor: not-allowed;
}

/* ========== Video Area ========== */
.video-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.video-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.video-card h3 {
  font-size: 0.95rem;
  color: #d1d5db;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.badge-live {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.badge-off {
  background: rgba(107, 114, 128, 0.2);
  color: #9ca3af;
}

/* ========== Video Wrapper ========== */
.video-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.remote-wrapper {
  aspect-ratio: 16 / 9;
}

.video-elem {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-hidden {
  display: none !important;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: #6b7280;
  font-size: 0.9rem;
}

/* ========== Remote Grid ========== */
.remote-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  min-height: 120px;
}

.remote-item {
  border-radius: 8px;
  border: 2px solid transparent;
  transition: border-color 0.3s;
}

.remote-item.subscribed {
  border-color: rgba(34, 197, 94, 0.4);
}

.remote-label {
  margin-top: 6px;
  font-size: 0.8rem;
  color: #9ca3af;
  text-align: center;
  word-break: break-all;
}

.no-remote {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: #6b7280;
  font-size: 0.9rem;
  grid-column: 1 / -1;
}

/* ========== Log Panel ========== */
.log-panel {
  margin: 0 32px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px 20px;
  max-height: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.log-panel h3 {
  font-size: 0.9rem;
  color: #9ca3af;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.log-list {
  flex: 1;
  overflow-y: auto;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 0.78rem;
  line-height: 1.6;
}

.log-entry {
  display: flex;
  gap: 10px;
}

.log-time {
  color: #6b7280;
  flex-shrink: 0;
}

.log-msg {
  color: #9ca3af;
}

.log-entry:has(.log-msg:contains("✅")) .log-msg {
  color: #22c55e;
}

.log-entry:has(.log-msg:contains("✗")) .log-msg,
.log-entry:has(.log-msg:contains("⛔")) .log-msg {
  color: #ef4444;
}

.log-entry:has(.log-msg:contains("⚠")) .log-msg {
  color: #f59e0b;
}

/* ========== Animations ========== */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ========== Responsive ========== */
@media (max-width: 768px) {
  .main {
    flex-direction: column;
    padding: 12px;
  }

  .config-panel {
    width: 100%;
  }

  .header {
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
  }

  .remote-grid {
    grid-template-columns: 1fr;
  }

  .log-panel {
    margin: 0 12px 12px;
  }
}
</style>