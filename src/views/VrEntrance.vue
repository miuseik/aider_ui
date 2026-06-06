<template>
  <div class="vr-ui-container">
    <h2 class="title">🤖 机器人选择 - 点击查看画面并进入VR</h2>
    <div class="robot-grid">
      <div 
        v-for="robot in robotList" 
        :key="robot.id"
        class="robot-card"
        :class="{ selected: selectedRobotId === robot.id }"
        @click="selectRobot(robot)"
      >
        <div class="video-area">
          <ArtcVideo
            v-if="selectedRobotId === robot.id"
            :channel-id="robot.channelId"
            :user-id="robot.userId"
            :user-name="robot.userName"
            :label="robot.name"
          />
          <div v-else class="robot-placeholder">
            <span>{{ robot.name }}</span>
            <span class="status-dot" :class="{ online: robot.online }"></span>
          </div>
        </div>

        <button 
          class="enter-vr-btn"
          :disabled="isConnecting || !robot.online || selectedRobotId !== robot.id"
          @click.stop="handleEnterVR(robot)"
        >
          {{ isConnecting && selectedRobotId === robot.id ? '连接中...' : '进入 VR' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ArtcVideo from '../components/ArtcVideo.vue'

const router = useRouter()
const isConnecting = ref(false)
const selectedRobotId = ref(null)

const robotList = ref([
  { id: 'robot_01', name: 'Aider Pro', online: true, channelId: 'test123', userId: 'web_robot01', userName: 'Robot #1' },
  { id: 'robot_02', name: 'Aloha Mini', online: false, channelId: 'aloha_01', userId: 'web_robot02', userName: 'Aloha #1' },
  { id: 'robot_03', name: 'SO100', online: false, channelId: 'so100_01', userId: 'web_robot03', userName: 'SO100 #1' },
])

function selectRobot(robot) {
  selectedRobotId.value = robot.id
}

async function handleEnterVR(robot) {
  if (!robot || !robot.id) return
  selectedRobotId.value = robot.id
  isConnecting.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    router.push({ path: '/vr-scene', query: { robot: robot.id, channel: robot.channelId } })
  } catch (err) {
    console.error(err)
  } finally {
    isConnecting.value = false
  }
}
</script>

<style scoped lang="scss">
.vr-ui-container {
  padding: 24px 32px;
  height: 100%;
  overflow-y: auto;
}
.title {
  font-size: 1.2rem;
  color: #e0e0e0;
  margin-bottom: 20px;
}
.robot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
.robot-card {
  background: rgba(255,255,255,0.03);
  border: 2px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { border-color: rgba(0,255,136,0.4); }
  &.selected { border-color: #00ff88; box-shadow: 0 0 20px rgba(0,255,136,0.2); }
}
.video-area {
  aspect-ratio: 16 / 9;
  background: #000;
}
.robot-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #6b7280;
  font-size: 1rem;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  &.online { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.5); }
}
.enter-vr-btn {
  width: 100%;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #00cc6a, #00994f);
  }
  &:disabled {
    background: #444;
    cursor: not-allowed;
    opacity: 0.5;
  }
}
</style>
