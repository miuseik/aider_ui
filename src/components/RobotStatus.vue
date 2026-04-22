<template>
  <div class="status-section">
    <div class="status-header">
      <h2>🤖 机器人状态<button class="refresh-btn" @click="$emit('refresh')" title="刷新状态">
        🔄
      </button></h2>

    </div>
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
      <div class="simulation-mode">
        <label>
          <input type="checkbox" :checked="simulationMode" @change="$emit('toggle-simulation', $event.target.checked)" />
          🧪 仿真测试模式（无需真机）
        </label>
      </div>
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
  },
  simulationMode: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle', 'toggle-simulation', 'refresh'])
</script>

<style scoped>


</style>
