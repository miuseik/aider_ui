<template>
  <div class="settings-content">
    <el-form :model="config" label-position="top" size="large">
      <el-divider content-position="left">
        <span style="font-size: 16px; font-weight: 600;">🤖 机械臂</span>
      </el-divider>
      
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="左臂名称">
            <el-input v-model="config.robot.left_arm.name" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="左臂端口">
            <el-input v-model="config.robot.left_arm.port" placeholder="/dev/ttyACM0" />
          </el-form-item>
        </el-col>
      </el-row>
      
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="右臂名称">
            <el-input v-model="config.robot.right_arm.name" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="右臂端口">
            <el-input v-model="config.robot.right_arm.port" placeholder="/dev/ttyACM1" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-divider content-position="left">
        <span style="font-size: 16px; font-weight: 600;">🌐 网络设置</span>
      </el-divider>
      
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="HTTPS 端口">
            <el-input-number 
              v-model="config.network.https_port" 
              :min="1024" 
              :max="65535"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="WebSocket 端口">
            <el-input-number 
              v-model="config.network.websocket_port" 
              :min="1024" 
              :max="65535"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>
      
      <el-form-item label="主机 IP 地址">
        <el-input v-model="config.network.host_ip" placeholder="0.0.0.0" />
      </el-form-item>

      <el-divider content-position="left">
        <span style="font-size: 16px; font-weight: 600;">🎮 控制参数</span>
      </el-divider>
      
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="VR 缩放系数">
            <el-input-number 
              v-model="config.robot.vr_to_robot_scale" 
              :step="0.1" 
              :min="0.1" 
              :max="5.0"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发送间隔 (毫秒)">
            <el-input-number 
              :model-value="sendIntervalMs" 
              @update:model-value="$emit('update:sendIntervalMs', $event)"
              :step="1" 
              :min="10" 
              :max="200"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>
      
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="位置步长 (米)">
            <el-input-number 
              v-model="config.control.keyboard.pos_step" 
              :step="0.001" 
              :min="0.001" 
              :max="0.1"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="角度步长 (度)">
            <el-input-number 
              v-model="config.control.keyboard.angle_step" 
              :step="0.5" 
              :min="0.5" 
              :max="45"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
        <el-button @click="$emit('close')">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          {{ saving ? '保存中...' : '💾 保存配置' }}
        </el-button>
        <el-button type="danger" @click="handleRestart" :loading="restarting">
          {{ restarting ? '重启中...' : '🔄 重启系统' }}
        </el-button>
      </div>
    </el-form>
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
