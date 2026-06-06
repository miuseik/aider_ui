 <template>
    <div class="vr-ui-container">
      <div class="robot-grid">
        <div 
          v-for="robot in robotList" 
          :key="robot.id"
          class="robot-card"
          :class="{ selected: selectedRobotId === robot.id }"
        >
          <div class="robot-placeholder">
            <span>{{ robot.name }}</span>
          </div>
          
          <button 
            class="enter-vr-btn"
            :disabled="isConnecting || !robot.online"
            @click="handleStartTracking(robot)"
          >
            {{ isConnecting && selectedRobotId === robot.id ? '连接中...' : '进入 VR' }}
          </button>
        </div>
      </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const emit = defineEmits(['vr-entered'])

const isVRMode = ref(false)
const isConnecting = ref(false)
const selectedRobotId = ref(null)

const robotList = ref([
  { id: 'robot_01', name: 'Aloha Mini #1', online: true },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_02', name: 'Aloha Mini #2', online: false },
  { id: 'robot_03', name: 'SO100 #1', online: false }
])

// 选择机器人
function selectRobot(robot) {
  selectedRobotId.value = robot.id
}

// 处理开始跟踪
async function handleStartTracking(robot) {
  if (!robot || !robot.id) return
  
  // 先选择该机器人
  selectedRobotId.value = robot.id
  
  isConnecting.value = true
  
  try {
    // 直接跳转到 VrScene 页面
    await new Promise(resolve => setTimeout(resolve, 300))
    router.push('/vr-scene')
  } catch (err) {
    ElMessage.error(`启动失败: ${err.message}`)
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
})
</script>

<style scoped lang="scss">
.vr-ui-container {
  position: fixed;
  top: 60px;
  left: 0;
  width: 100vw;
  height: calc(100vh - 60px);
  pointer-events: none;
  z-index: 9998;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 40px;
  overflow-y: auto;
  transition: background 0.3s ease;
}

/* 自定义滚动条样式 */
.vr-ui-container::-webkit-scrollbar {
  width: 8px;
}

.vr-ui-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.vr-ui-container::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 136, 0.3);
  border-radius: 4px;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 255, 136, 0.5);
  }
}

.vr-ui-container::-webkit-scrollbar-thumb:active {
  background: rgba(0, 255, 136, 0.7);
}

/* 机器人网格布局 - 响应式自适应 */
.robot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  width: 100%;
  max-width: 1600px;
  pointer-events: auto;
}

.robot-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  overflow: hidden;
  background: var(--card-bg);
  border: 2px solid transparent;
  height: auto;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--accent-color);
  }

  &.selected {
    border-color: var(--accent-color);
    box-shadow: 0 0 20px rgba(var(--accent-color), 0.4);
  }
}

/* 进入VR按钮 */
.enter-vr-btn {
  width: 100%;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  pointer-events: auto;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #00cc6a 0%, #00994f 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: linear-gradient(135deg, #666 0%, #444 100%);
    cursor: not-allowed;
    opacity: 0.5;
  }
}
</style>
