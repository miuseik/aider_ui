<template>
  <div class="spaceship-profile">
    <!-- 星空背景 -->
    <div class="stars"></div>
    
    <!-- 主面板 -->
    <div class="cockpit-panel">
      <!-- 头部 -->
      <div class="panel-header">
        <h1 class="title">控制中心</h1>
        <div class="user-badge">
          <span class="badge-icon">◈</span>
          <span class="badge-text">{{ userInfo.username }}</span>
        </div>
      </div>
      
      <!-- 状态栏 -->
      <div class="status-bar">
        <div class="status-item">
          <span class="dot green"></span>
          <span>系统就绪</span>
        </div>
        <div class="status-item">
          <span class="dot blue"></span>
          <span>安全连接</span>
        </div>
        <div class="status-item">
          <span>会话时长: {{ sessionTime }}</span>
        </div>
      </div>
      
      <!-- 主要内容区 -->
      <div class="panel-content">
        <!-- 左侧：用户信息 -->
        <div class="info-section">
          <h2 class="section-title">身份信息</h2>
          <div class="data-list">
            <div class="data-row">
              <span class="label">用户名</span>
              <span class="value">{{ userInfo.username }}</span>
            </div>
            <div class="data-row">
              <span class="label">邮箱</span>
              <span class="value">{{ userInfo.email }}</span>
            </div>
            <div class="data-row">
              <span class="label">角色</span>
              <span class="value highlight">管理员</span>
            </div>
            <div class="data-row">
              <span class="label">加入时间</span>
              <span class="value">{{ userInfo.joinDate }}</span>
            </div>
          </div>
        </div>
        
        <!-- 右侧：操作按钮 -->
        <div class="action-section">
          <h2 class="section-title">快速操作</h2>
          <div class="button-grid">
            <button class="action-btn" @click="handleEditProfile">
              <span>编辑资料</span>
            </button>
            
            <button class="action-btn" @click="handleChangePassword">
              <span>修改密码</span>
            </button>
            
            <button class="action-btn warning" @click="handleClearCache">
              <span>清除缓存</span>
            </button>
            
            <button class="action-btn danger" @click="handleLogout">
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- 底部 -->
      <div class="panel-footer">
        <div class="footer-info">
          <span>终端 ID: {{ terminalId }}</span>
          <span>|</span>
          <span>延迟: {{ latency }}ms</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const userInfo = ref({
  username: 'Chenzhuo007',
  email: 'chenzhuo@example.com',
  joinDate: '2024-01-15'
})

const sessionTime = ref('00:00:00')
const terminalId = ref('TRM-' + Math.random().toString(36).substr(2, 9).toUpperCase())
const latency = ref(12)

let sessionTimer = null
let latencyTimer = null
let sessionSeconds = 0

onMounted(() => {
  startSessionTimer()
  startLatencySimulation()
})

onUnmounted(() => {
  if (sessionTimer) clearInterval(sessionTimer)
  if (latencyTimer) clearInterval(latencyTimer)
})

const startSessionTimer = () => {
  sessionTimer = setInterval(() => {
    sessionSeconds++
    const hours = Math.floor(sessionSeconds / 3600).toString().padStart(2, '0')
    const minutes = Math.floor((sessionSeconds % 3600) / 60).toString().padStart(2, '0')
    const seconds = (sessionSeconds % 60).toString().padStart(2, '0')
    sessionTime.value = `${hours}:${minutes}:${seconds}`
  }, 1000)
}

const startLatencySimulation = () => {
  latencyTimer = setInterval(() => {
    latency.value = Math.floor(Math.random() * 20) + 5
  }, 2000)
}

const handleEditProfile = () => {
  alert('编辑资料功能开发中')
}

const handleChangePassword = () => {
  alert('修改密码功能开发中')
}

const handleClearCache = () => {
  if (confirm('确定要清除缓存吗？')) {
    localStorage.clear()
    alert('缓存已清除')
  }
}

const handleLogout = () => {
  if (confirm('确定要退出登录吗？')) {
    router.push('/login')
  }
}
</script>

<style scoped>
.spaceship-profile {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: #000;
  position: relative;
  overflow: hidden;
}

/* 星空背景 */
.stars {
  position: absolute;
  width: 100%;
  height: 100%;
  background-image: 
    radial-gradient(2px 2px at 20px 30px, #fff, transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
    radial-gradient(1px 1px at 90px 40px, #fff, transparent),
    radial-gradient(2px 2px at 160px 120px, rgba(255,255,255,0.9), transparent);
  background-repeat: repeat;
  background-size: 250px 250px;
  animation: twinkle 5s ease-in-out infinite;
  opacity: 0.6;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.8; }
}

/* 驾驶舱面板 */
.cockpit-panel {
  position: relative;
  width: 100%;
  max-width: 1000px;
  padding: 40px;
  background: linear-gradient(135deg, rgba(20, 30, 48, 0.95), rgba(36, 59, 85, 0.95));
  border: 1px solid rgba(100, 200, 255, 0.3);
  border-radius: 20px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
}

/* 头部 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(100, 200, 255, 0.2);
}

.title {
  font-size: 32px;
  font-weight: 300;
  color: #fff;
  letter-spacing: 6px;
  margin: 0;
  text-shadow: 0 0 20px rgba(100, 200, 255, 0.5);
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: rgba(100, 200, 255, 0.1);
  border: 1px solid rgba(100, 200, 255, 0.4);
  border-radius: 8px;
}

.badge-icon {
  color: rgba(100, 200, 255, 0.9);
  font-size: 18px;
}

.badge-text {
  color: rgba(100, 200, 255, 0.9);
  font-size: 15px;
  letter-spacing: 2px;
}

/* 状态栏 */
.status-bar {
  display: flex;
  gap: 30px;
  margin-bottom: 30px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(100, 200, 255, 0.2);
  border-radius: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}

.dot.green {
  background: #00ff88;
  color: #00ff88;
}

.dot.blue {
  background: #00ccff;
  color: #00ccff;
}

/* 内容区 */
.panel-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.section-title {
  font-size: 16px;
  font-weight: 400;
  color: rgba(100, 200, 255, 0.9);
  letter-spacing: 3px;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(100, 200, 255, 0.2);
}

/* 数据列表 */
.data-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.data-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 15px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  border-left: 3px solid rgba(100, 200, 255, 0.4);
}

.data-row .label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.data-row .value {
  color: #fff;
  font-size: 14px;
}

.data-row .value.highlight {
  color: rgba(100, 200, 255, 0.9);
}

/* 按钮网格 */
.button-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.action-btn {
  padding: 14px 20px;
  background: rgba(100, 200, 255, 0.1);
  border: 1px solid rgba(100, 200, 255, 0.3);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn:hover {
  background: rgba(100, 200, 255, 0.2);
  border-color: rgba(100, 200, 255, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(100, 200, 255, 0.3);
}

.action-btn.warning {
  background: rgba(255, 170, 0, 0.1);
  border-color: rgba(255, 170, 0, 0.4);
}

.action-btn.warning:hover {
  background: rgba(255, 170, 0, 0.2);
  border-color: rgba(255, 170, 0, 0.6);
  box-shadow: 0 4px 15px rgba(255, 170, 0, 0.3);
}

.action-btn.danger {
  background: rgba(255, 68, 68, 0.1);
  border-color: rgba(255, 68, 68, 0.4);
}

.action-btn.danger:hover {
  background: rgba(255, 68, 68, 0.2);
  border-color: rgba(255, 68, 68, 0.6);
  box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);
}

/* 底部 */
.panel-footer {
  padding-top: 20px;
  border-top: 1px solid rgba(100, 200, 255, 0.2);
}

.footer-info {
  display: flex;
  justify-content: center;
  gap: 15px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

@media (max-width: 768px) {
  .panel-content {
    grid-template-columns: 1fr;
  }
  
  .button-grid {
    grid-template-columns: 1fr;
  }
}
</style>
