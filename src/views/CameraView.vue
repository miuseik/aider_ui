<script setup>
import { ref, computed } from 'vue'
import { useWebRTC } from '@/composables/useWebRTC.js'

const videoRef = ref(null)
const { connectionState, iceConnectionState, error, stateLabel, micEnabled, micUnavailable, start, stop, enableMic, disableMic } = useWebRTC(videoRef)

const isConnected = computed(() => connectionState.value === 'connected')
const isLoading = computed(() => connectionState.value === 'connecting')
const isFailed = computed(() => connectionState.value === 'failed')
const isIdle = computed(() => connectionState.value === 'disconnected')

function toggleMic() {
  if (micEnabled.value) {
    disableMic()
  } else {
    enableMic()
  }
}
</script>

<template>
  <div class="camera-page">
    <h2 class="page-title">📷 机器人摄像头</h2>
    <p class="page-desc">实时查看机器人摄像头画面（WebRTC 低延迟推流）</p>

    <div class="camera-card">
      <div class="video-wrapper">
        <video ref="videoRef" autoplay playsinline muted class="video-player" />

        <div v-if="!isConnected" class="video-overlay">
          <div v-if="isLoading" class="overlay-center">
            <div class="spinner" />
            <p>正在连接...</p>
          </div>
          <div v-else-if="isFailed" class="overlay-center">
            <div class="error-icon">✕</div>
            <p>连接失败</p>
            <p v-if="error" class="error-msg">{{ error }}</p>
            <button class="btn btn-primary" @click="start">重试</button>
          </div>
          <div v-else-if="isIdle" class="overlay-center">
            <div class="play-icon">▶</div>
            <p>点击播放开始观看</p>
            <button class="btn btn-primary" @click="start">开始播放</button>
          </div>
          <div v-else class="overlay-center">
            <p>连接已断开</p>
            <button class="btn btn-primary" @click="start">重新连接</button>
          </div>
        </div>
      </div>

      <div class="status-bar">
        <span class="status-dot" :class="{ active: isConnected }" />
        <span>{{ stateLabel() }}</span>
        <span v-if="iceConnectionState" class="ice-state">ICE: {{ iceConnectionState }}</span>
        <button
          v-if="isConnected"
          class="btn-mic"
          :class="{ active: micEnabled, unavailable: micUnavailable }"
          :disabled="micUnavailable"
          @click="toggleMic"
          :title="micUnavailable ? '此设备无麦克风' : micEnabled ? '关闭麦克风' : '开启麦克风'"
        >{{ micUnavailable ? '🚫' : micEnabled ? '🎤' : '🔇' }}</button>
        <button v-if="isConnected" class="btn btn-stop" @click="stop">断开</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.camera-page {
  padding: 30px 40px;
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  color: #00ff88;
  margin: 0 0 8px;
}

.page-desc {
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 24px;
  font-size: 14px;
}

.camera-card {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 255, 136, 0.15);
  border-radius: 12px;
  overflow: hidden;
}

.video-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #111;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
}

.overlay-center {
  text-align: center;
  color: #fff;
}

.play-icon, .error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.error-icon { color: #ff6b6b; }

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid rgba(0, 255, 136, 0.2);
  border-top-color: #00ff88;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.overlay-center p {
  margin: 0 0 8px;
  font-size: 16px;
}

.error-msg {
  font-size: 13px !important;
  color: #ff6b6b;
  max-width: 280px;
  margin: 0 auto 16px !important;
}

.btn {
  border: none;
  border-radius: 8px;
  padding: 10px 28px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
}
.btn-primary {
  background: #00aa66;
  color: #fff;
  &:hover {
    background: #008855;
    transform: translateY(-1px);
  }
}
.btn-stop {
  background: rgba(255,255,255,.1);
  color: #ff6b6b;
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
  &:hover { background: rgba(255,255,255,.18); }
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}
.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #ff6b6b;
  &.active { background: #00ff88; box-shadow: 0 0 6px rgba(0,255,136,.6); }
}
.ice-state {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  margin-left: auto;
}
.btn-mic {
  width: 36px; height: 36px;
  border: 1px solid rgba(255,255,255,.15);
  border-radius: 50%;
  background: rgba(255,255,255,.05);
  cursor: pointer;
  font-size: 16px;
  line-height: 36px;
  text-align: center;
  transition: all .2s;
  margin-left: auto;
  &:hover { background: rgba(255,255,255,.12); }
  &.active {
    background: rgba(0, 255, 136, .2);
    border-color: rgba(0, 255, 136, .5);
  }
}
</style>
