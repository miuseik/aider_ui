<template>
  <div class="vr-ui-container">
    <!-- VR 说明面板 -->
    <div  id="vr-instructions-panel" class="instructions-panel">
      <h2>VR 控制器使用说明</h2>
      <div class="instructions-content">
        <div class="image-section">
          <img src="/media/telegrip_instructions.jpg" alt="VR 控制器使用说明">
        </div>
        <div class="text-section">
          <div class="instruction-item">
            <strong class="grip-text">握把按钮：</strong>按住以移动机械臂
          </div>
          <div class="instruction-item">
            <strong class="trigger-text">扳机：</strong>按住以闭合夹爪
          </div>
        </div>
      </div>
    </div>

    <!-- 开始跟踪按钮 -->
    <button 
      id="start-tracking-button"
      class="start-button"
      :disabled="isConnecting"
      @click="handleStartTracking"
    >
      {{ buttonText }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['vr-entered'])

const isVRMode = ref(false)
const isConnecting = ref(false)

// 按钮文本
const buttonText = computed(() => {
  if (isConnecting.value) return '连接中...'
  return '开始控制器跟踪'
})

// 处理开始跟踪
async function handleStartTracking() {
  // 先通知父组件显示 VrScene
  emit('vr-entered')
  
  // 等待 VrScene 挂载和 a-scene 初始化
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const sceneEl = document.querySelector('a-scene')
  if (!sceneEl) {
    alert('VR 场景不可用，请刷新页面')
    return
  }
  
  isConnecting.value = true
  
  try {
    // 检查机械臂状态
    const statusResponse = await fetch('/api/status')
    const status = await statusResponse.json()
    console.log(status)
    if (!status.robotEngaged) {
      // 连接机械臂
      const connectResponse = await fetch('/api/robot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      })
      const connectResult = await connectResponse.json()
      
      if (!connectResult.success) {
        throw new Error(connectResult.error || '无法连接机器人机械臂')
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // 进入 VR
    await sceneEl.enterVR(true)
  } catch (err) {
    alert(`启动失败: ${err.message}`)
  } finally {
    isConnecting.value = false
  }
}

// 监听 VR 进入/退出事件
function setupVREventListeners() {
  const sceneEl = document.querySelector('a-scene')
  if (!sceneEl) return
  
  sceneEl.addEventListener('enter-vr', () => {
    isVRMode.value = true
    emit('vr-entered')  // 通知父组件
  })
  
  sceneEl.addEventListener('exit-vr', () => {
    isVRMode.value = false
  })
}

onMounted(() => {
  setupVREventListeners()
})

onUnmounted(() => {
  // 清理
})
</script>

<style scoped>
.vr-ui-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9998;
}

.instructions-panel {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 90%;
  width: 600px;
  background: rgba(15, 52, 96, 0.95);
  border-radius: 12px;
  padding: 20px;
  color: white;
  pointer-events: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
}

.instructions-panel h2 {
  margin: 0 0 15px 0;
  font-size: 1.2em;
  text-align: center;
}

.instructions-content {
  display: flex;
  gap: 15px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.image-section {
  flex: 1;
  min-width: 150px;
  text-align: center;
}

.image-section img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.text-section {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}

.instruction-item {
  padding: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 6px;
}

.grip-text {
  color: #ee4d9a;
}

.trigger-text {
  color: #9af58c;
}

.start-button {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 20px 40px;
  font-size: 20px;
  font-weight: bold;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}

.start-button:disabled {
  background-color: #666;
  cursor: not-allowed;
}
</style>
