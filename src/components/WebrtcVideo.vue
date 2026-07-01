<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useWebRTC } from '@/composables/useWebRTC.js'

const props = defineProps({
  autoStart: { type: Boolean, default: true },
})

const videoRef = ref(null)
const { connectionState, stateLabel, micEnabled, start, stop, enableMic, disableMic } = useWebRTC(videoRef)

onMounted(() => {
  if (props.autoStart) {
    start()
  }
})

onUnmounted(() => {
  stop()
})

function getVideoEl() {
  return videoRef.value
}

defineExpose({ videoEl: videoRef, getVideoEl, start, stop, connectionState, micEnabled, enableMic, disableMic })
</script>

<template>
  <video ref="videoRef" autoplay playsinline muted class="webrtc-video">
    <slot />
  </video>
</template>

<style scoped>
.webrtc-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #000;
}
</style>
