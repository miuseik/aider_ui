<template>
  <div class="settings-modal" :class="{ show: visible }" @click.self="$emit('close')">
    <div class="settings-content">
      <div class="settings-header">
        <div class="settings-title">系统配置</div>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      
      <form id="settingsForm" @submit.prevent="handleSave">
        <div class="settings-section">
          <h3>🤖 机械臂</h3>
          <div class="form-row">
            <div class="form-group">
              <label for="leftArmName">左臂名称</label>
              <input type="text" id="leftArmName" v-model="config.robot.left_arm.name">
            </div>
            <div class="form-group">
              <label for="leftArmPort">左臂端口</label>
              <input type="text" id="leftArmPort" v-model="config.robot.left_arm.port" placeholder="/dev/ttyACM0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="rightArmName">右臂名称</label>
              <input type="text" id="rightArmName" v-model="config.robot.right_arm.name">
            </div>
            <div class="form-group">
              <label for="rightArmPort">右臂端口</label>
              <input type="text" id="rightArmPort" v-model="config.robot.right_arm.port" placeholder="/dev/ttyACM1">
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>🌐 网络设置</h3>
          <div class="form-row">
            <div class="form-group">
              <label for="httpsPort">HTTPS 端口</label>
              <input type="number" id="httpsPort" v-model.number="config.network.https_port" min="1024" max="65535">
            </div>
            <div class="form-group">
              <label for="websocketPort">WebSocket 端口</label>
              <input type="number" id="websocketPort" v-model.number="config.network.websocket_port" min="1024" max="65535">
            </div>
          </div>
          <div class="form-group">
            <label for="hostIp">主机 IP 地址</label>
            <input type="text" id="hostIp" v-model="config.network.host_ip" placeholder="0.0.0.0">
          </div>
        </div>

        <div class="settings-section">
          <h3>🎮 控制参数</h3>
          <div class="form-row">
            <div class="form-group">
              <label for="vrScale">VR 缩放系数</label>
              <input type="number" id="vrScale" v-model.number="config.robot.vr_to_robot_scale" step="0.1" min="0.1" max="5.0">
            </div>
            <div class="form-group">
              <label for="sendInterval">发送间隔 (毫秒)</label>
              <input type="number" id="sendInterval" :value="sendIntervalMs" @input="$emit('update:sendIntervalMs', Number($event.target.value))" step="1" min="10" max="200">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="posStep">位置步长 (米)</label>
              <input type="number" id="posStep" v-model.number="config.control.keyboard.pos_step" step="0.001" min="0.001" max="0.1">
            </div>
            <div class="form-group">
              <label for="angleStep">角度步长 (度)</label>
              <input type="number" id="angleStep" v-model.number="config.control.keyboard.angle_step" step="0.5" min="0.5" max="45">
            </div>
          </div>
        </div>

        <div class="button-row">
          <button type="submit" class="save-button" :disabled="saving">
            {{ saving ? '保存中...' : '💾 保存配置' }}
          </button>
          <button type="button" class="restart-button" :disabled="restarting" @click="handleRestart">
            {{ restarting ? '重启中...' : '🔄 重启系统' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    required: true
  },
  saving: {
    type: Boolean,
    default: false
  },
  restarting: {
    type: Boolean,
    default: false
  },
  sendIntervalMs: {
    type: Number,
    default: 50
  }
})

const emit = defineEmits(['close', 'save', 'restart', 'update:sendIntervalMs'])

function handleSave() {
  emit('save')
}

function handleRestart() {
  emit('restart')
}
</script>

<style>
/* 样式从全局 styles.css 继承 */
</style>
