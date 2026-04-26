<template>
  <div class="spaceship-login">
    <!-- 星空背景 -->
    <div class="stars"></div>
    
    <!-- 主面板 -->
    <div class="cockpit-panel">
      <!-- 标题 -->
      <div class="header">
        <h1 class="title">AIDER VR</h1>
        <div class="subtitle">机器人指挥系统</div>
      </div>
      
      <!-- 切换标签 -->
      <div class="tab-switcher">
        <button 
          :class="['tab-btn', { active: activeTab === 'login' }]"
          @click="activeTab = 'login'"
        >
          登录
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'register' }]"
          @click="activeTab = 'register'"
        >
          注册
        </button>
      </div>
      
      <!-- 登录表单 -->
      <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <label>用户名</label>
          <input 
            v-model="loginForm.username"
            type="text"
            placeholder="请输入用户名"
            required
          />
        </div>
        
        <div class="input-group">
          <label>密码</label>
          <input 
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            required
          />
        </div>
        
        <button type="submit" class="launch-btn">
          <span>启动</span>
        </button>
      </form>
      
      <!-- 注册表单 -->
      <form v-else @submit.prevent="handleRegister" class="login-form">
        <div class="input-group">
          <label>用户名</label>
          <input 
            v-model="registerForm.username"
            type="text"
            placeholder="创建用户名"
            required
          />
        </div>
        
        <div class="input-group">
          <label>邮箱</label>
          <input 
            v-model="registerForm.email"
            type="email"
            placeholder="请输入邮箱"
            required
          />
        </div>
        
        <div class="input-group">
          <label>密码</label>
          <input 
            v-model="registerForm.password"
            type="password"
            placeholder="创建密码"
            required
          />
        </div>
        
        <div class="input-group">
          <label>确认密码</label>
          <input 
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            required
          />
        </div>
        
        <button type="submit" class="launch-btn">
          <span>创建账户</span>
        </button>
      </form>
      
      <!-- 状态指示器 -->
      <div class="status-bar">
        <div class="status-item">
          <span class="dot green"></span>
          <span>系统就绪</span>
        </div>
        <div class="status-item">
          <span class="dot blue"></span>
          <span>安全连接</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeTab = ref('login')

const loginForm = ref({
  username: '',
  password: ''
})

const registerForm = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const handleLogin = () => {
  console.log('Login:', loginForm.value)
  router.push('/')
}

const handleRegister = () => {
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    alert('两次输入的密码不一致')
    return
  }
  console.log('Register:', registerForm.value)
  alert('注册成功')
  activeTab.value = 'login'
}
</script>

<style scoped>
.spaceship-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
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
    radial-gradient(2px 2px at 160px 120px, rgba(255,255,255,0.9), transparent),
    radial-gradient(1px 1px at 230px 80px, #fff, transparent);
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
  width: 420px;
  padding: 50px 40px;
  background: linear-gradient(135deg, rgba(20, 30, 48, 0.95), rgba(36, 59, 85, 0.95));
  border: 1px solid rgba(100, 200, 255, 0.3);
  border-radius: 20px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
}

/* 标题 */
.header {
  text-align: center;
  margin-bottom: 40px;
}

.title {
  font-size: 36px;
  font-weight: 300;
  color: #fff;
  letter-spacing: 8px;
  margin: 0 0 10px 0;
  text-shadow: 0 0 20px rgba(100, 200, 255, 0.5);
}

.subtitle {
  font-size: 11px;
  color: rgba(100, 200, 255, 0.7);
  letter-spacing: 4px;
  font-weight: 300;
}

/* 标签切换 */
.tab-switcher {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  background: transparent;
  border: 1px solid rgba(100, 200, 255, 0.4);
  color: rgba(100, 200, 255, 0.8);
  cursor: pointer;
  font-size: 13px;
  letter-spacing: 2px;
  transition: all 0.3s;
  border-radius: 6px;
}

.tab-btn:hover {
  background: rgba(100, 200, 255, 0.1);
  border-color: rgba(100, 200, 255, 0.6);
}

.tab-btn.active {
  background: rgba(100, 200, 255, 0.15);
  border-color: rgba(100, 200, 255, 0.8);
  color: #fff;
}

/* 表单 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 11px;
  color: rgba(100, 200, 255, 0.8);
  letter-spacing: 2px;
  font-weight: 400;
}

.input-group input {
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(100, 200, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 15px;
  outline: none;
  transition: all 0.3s;
}

.input-group input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.input-group input:focus {
  border-color: rgba(100, 200, 255, 0.6);
  background: rgba(0, 0, 0, 0.4);
  box-shadow: 0 0 15px rgba(100, 200, 255, 0.2);
}

/* 启动按钮 */
.launch-btn {
  margin-top: 10px;
  padding: 16px;
  background: linear-gradient(135deg, #0066cc, #0099ff);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(0, 102, 204, 0.3);
}

.launch-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(0, 102, 204, 0.5);
  background: linear-gradient(135deg, #0077dd, #00aaff);
}

.launch-btn:active {
  transform: translateY(0);
}

/* 状态栏 */
.status-bar {
  margin-top: 35px;
  padding-top: 25px;
  border-top: 1px solid rgba(100, 200, 255, 0.15);
  display: flex;
  justify-content: space-around;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
}

.dot {
  width: 6px;
  height: 6px;
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
</style>
