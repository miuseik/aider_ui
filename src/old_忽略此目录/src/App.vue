<script setup>
import { ref } from 'vue'
import VRScene from './components/VRScene.vue'

const showVR = ref(false)

const enterVR = () => {
  showVR.value = true
}
</script>

<template>
  <div v-if="!showVR" class="home">
    <h1>VR 应用</h1>
    <button @click="enterVR" class="enter-btn">进入 VR</button>
  </div>
  <div v-else class="vr-container">
    <VRScene />
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1a1a1a;
  color: white;
}

.enter-btn {
  padding: 20px 60px;
  font-size: 24px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.enter-btn:hover {
  background: #359c6d;
  transform: scale(1.05);
}

.vr-container {
  width: 100vw;
  height: 100vh;
}

.vr-container iframe {
  width: 100%;
  height: 100%;
}
</style>
