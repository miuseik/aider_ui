<template>
  <div class="keyboard-help" :class="{ active: isKeyboardEnabled }">
    <!-- Collapsed state: just the enable button + 姿态选择 -->
    <div class="keyboard-help-collapsed" v-show="!isKeyboardEnabled">
      <div class="collapsed-row">
        <div class="control-toggle" @click="$emit('toggle')">
          <span>🎮</span>
          <span>{{ isKeyboardEnabled ? '禁用键盘控制' : '启用键盘控制' }}</span>
        </div>
        <div v-if="showPoseSelector" class="pose-selector-inline">
          <span class="pose-label">🎯 姿态</span>
          <el-select
            :model-value="currentPoseName"
            placeholder="选择姿态"
            size="default"
            :loading="poseLoading"
            @change="$emit('pose-change', $event)"
            class="pose-select"
          >
            <el-option
              v-for="(pose, name) in poseList"
              :key="name"
              :label="name"
              :value="name"
            />
          </el-select>
        </div>
      </div>
    </div>
    
    <!-- Expanded state: title, disable button, and content -->
    <div class="keyboard-help-expanded" v-show="isKeyboardEnabled">
      <div class="keyboard-help-header">
        <div class="control-toggle active" @click="$emit('toggle')">
          <span>🎮</span>
          <span>禁用键盘控制</span>
        </div>
        <div v-if="showPoseSelector" class="pose-selector-inline">
          <span class="pose-label">🎯 姿态</span>
          <el-select
            :model-value="currentPoseName"
            placeholder="选择姿态"
            size="default"
            :loading="poseLoading"
            @change="$emit('pose-change', $event)"
            class="pose-select"
          >
            <el-option
              v-for="(pose, name) in poseList"
              :key="name"
              :label="name"
              :value="name"
            />
          </el-select>
        </div>
        <div class="help-title">
          <span>⌨️</span>
          键盘控制
        </div>
      </div>
      
      <div class="help-columns">
        <div class="help-column">
          <h4>左臂</h4>
          <div class="key-group">
            <div class="key-row">
              <span><kbd class="key">W</kbd> / <kbd class="key">S</kbd></span>
              <span class="key-desc">前进 / 后退</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">A</kbd> / <kbd class="key">D</kbd></span>
              <span class="key-desc">左移 / 右移</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">Q</kbd> / <kbd class="key">E</kbd></span>
              <span class="key-desc">下降 / 上升</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">Z</kbd> / <kbd class="key">X</kbd></span>
              <span class="key-desc">腕部翻滚</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">R</kbd> / <kbd class="key">T</kbd></span>
              <span class="key-desc">腕部弯曲</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">F</kbd> / <kbd class="key">G</kbd></span>
              <span class="key-desc">腕部偏航</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">C</kbd></span>
              <span class="key-desc">切换夹爪</span>
            </div>
          </div>
        </div>
        <div class="help-column">
          <h4>底盘</h4>
          <div class="key-group">
            <div class="key-row">
              <span><kbd class="key">↑</kbd> / <kbd class="key">↓</kbd></span>
              <span class="key-desc">前进 / 后退</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">←</kbd> / <kbd class="key">→</kbd></span>
              <span class="key-desc">左转 / 右转</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">7</kbd> / <kbd class="key">9</kbd></span>
              <span class="key-desc">左平移 / 右平移</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">V</kbd> / <kbd class="key">B</kbd></span>
              <span class="key-desc">升 / 降</span>
            </div>
          </div>
        </div>
        <div class="help-column">
          <h4>右臂</h4>
          <div class="key-group">
            <div class="key-row">
              <span><kbd class="key">I</kbd> / <kbd class="key">K</kbd></span>
              <span class="key-desc">前进 / 后退</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">J</kbd> / <kbd class="key">L</kbd></span>
              <span class="key-desc">左移 / 右移</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">U</kbd> / <kbd class="key">O</kbd></span>
              <span class="key-desc">下降 / 上升</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">H</kbd> / <kbd class="key">Y</kbd></span>
              <span class="key-desc">腕部弯曲</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">P</kbd> / <kbd class="key">/</kbd></span>
              <span class="key-desc">腕部偏航</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">N</kbd> / <kbd class="key">M</kbd></span>
              <span class="key-desc">腕部翻滚</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">.</kbd></span>
              <span class="key-desc">切换夹爪</span>
            </div>
          </div>
        </div>
        <div class="help-column">
          <h4>身体（腰/头）</h4>
          <div class="key-group">
            <div class="key-row">
              <span><kbd class="key">1</kbd> / <kbd class="key">2</kbd></span>
              <span class="key-desc">腰部 左转 / 右转</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">3</kbd> / <kbd class="key">4</kbd></span>
              <span class="key-desc">头部 左转 / 右转</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">5</kbd> / <kbd class="key">6</kbd></span>
              <span class="key-desc">头部 低头 / 抬头</span>
            </div>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #bdc3c7; color: #7f8c8d; font-size: 13px;">
        <strong>提示：</strong>按下移动键时位置控制会自动激活。
        <kbd class="key">Tab</kbd> 切换左臂位置控制，<kbd class="key">Enter</kbd> 切换右臂位置控制，
        <kbd class="key">ESC</kbd> 断开连接。
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isKeyboardEnabled: {
    type: Boolean,
    default: false
  },
  poseList: {
    type: Object,
    default: () => ({})
  },
  currentPoseName: {
    type: String,
    default: ''
  },
  poseLoading: {
    type: Boolean,
    default: false
  },
  showPoseSelector: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle', 'pose-change'])
</script>

<style scoped>
.help-columns {
  display: flex;
  gap: 20px;
}

.help-column {
  flex: 1;
  min-width: 0;
}

.pose-selector-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pose-label {
  color: rgba(100, 200, 255, 0.85);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.pose-select {
  width: 180px;
}

.collapsed-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
