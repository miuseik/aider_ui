<template>
  <div class="status-section">
    <h2>🤖 机器人状态</h2>
    <div class="status-grid">
      <div class="status-item">
        <div class="status-indicator" :class="{ connected: status.left_arm_connected }"></div>
        <span>左臂</span>
      </div>
      <div class="status-item">
        <div class="status-indicator" :class="{ connected: status.right_arm_connected }"></div>
        <span>右臂</span>
      </div>
      <div class="status-item">
        <div class="status-indicator" :class="{ connected: status.vrConnected }"></div>
        <span>VR 已连接</span>
      </div>
      <div class="status-item">
        <div class="status-indicator" :class="{ connected: status.wsConnected }"></div>
        <span>WebSocket</span>
      </div>
    </div>
    
    <!-- Robot Engagement Controls -->
    <div class="robot-controls">
      <button 
        id="robotEngageBtn" 
        class="engage-btn" 
        :class="{ disconnect: isRobotEngaged, 'needs-attention': !isRobotEngaged && showWarning }"
        @click="$emit('toggle')"
      >
        <span>{{ isRobotEngaged ? '🔌 断开机器人' : '🔌 连接机器人' }}</span>
      </button>
      <div class="engagement-status">
        <span :style="{ color: '#FFFFFF' }">{{ isRobotEngaged ? '电机已使能' : '电机未使能' }}</span>
      </div>
      <div class="connection-hint" v-show="!isRobotEngaged">点击连接以启动 telegrip</div>
      <div class="connection-warning" :class="{ show: showWarning }">
        ⚠️ 在您点击连接之前，机械臂未使能
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  status: {
    type: Object,
    required: true
  },
  isRobotEngaged: {
    type: Boolean,
    default: false
  },
  showWarning: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle'])
</script>

<style>
/* 样式从全局 styles.css 继承 */
</style>
