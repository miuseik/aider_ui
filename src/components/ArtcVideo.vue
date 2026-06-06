<template>
  <div class="artc-video" :class="{ connected: hasVideo }">
    <video
      ref="videoEl"
      autoplay
      muted
      playsinline
      class="video-elem"
    ></video>
    <div v-if="!hasVideo" class="placeholder">
      <span v-if="loading">⏳ 连接中...</span>
      <span v-else>📷 {{ label }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { artcManager, ChannelState } from '../utils/artcManager'
import { ARTC_CONFIG } from '../config/artc'

const props = defineProps({
  channelId: { type: String, default: ARTC_CONFIG.channelId },
  userId: { type: String, default: 'web_subscriber' },
  userName: { type: String, default: 'Web User' },
  label: { type: String, default: '无视频' },
})

const videoEl = ref(null)
const loading = ref(false)
const hasVideo = ref(false)

let currentUid = null

// 监听到远端用户后绑定 video 元素
function handleRemoteUsers(users) {
  for (const u of users) {
    if (u.hasVideo && u.videoSubState === 3) {
      hasVideo.value = true
      if (videoEl.value && u.uid !== currentUid) {
        currentUid = u.uid
        artcManager.registerVideoElement(u.uid, videoEl.value)
        artcManager.setRemoteView(videoEl.value, u.uid)
      }
    }
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await artcManager.initialize()
    artcManager.onRemoteUsersChange(handleRemoteUsers)

    artcManager.onStateChange((s) => {
      loading.value = s === ChannelState.JOINING
    })

    await artcManager.joinChannel({
      appId: ARTC_CONFIG.appId,
      channelId: props.channelId,
      userId: props.userId,
      userName: props.userName,
    })
  } catch (e) {
    console.warn('[ArtcVideo]', e)
    loading.value = false
  }
})

onUnmounted(() => {
  artcManager.leaveChannel().catch(() => {})
})

defineExpose({ videoEl })
</script>

<style scoped>
.artc-video {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}
.video-elem {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.6);
  color: #6b7280;
  font-size: 0.9rem;
}
.artc-video.connected .placeholder {
  display: none;
}
</style>
