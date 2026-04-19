<template>
  <div class="keyboard-help" :class="{ active: isKeyboardEnabled }">
    <!-- Collapsed state: just the enable button -->
    <div class="keyboard-help-collapsed" v-show="!isKeyboardEnabled">
      <div class="control-toggle" @click="$emit('toggle')">
        <span>🎮</span>
        <span>{{ isKeyboardEnabled ? '禁用键盘控制' : '启用键盘控制' }}</span>
      </div>
    </div>
    
    <!-- Expanded state: title, disable button, and content -->
    <div class="keyboard-help-expanded" v-show="isKeyboardEnabled">
      <div class="keyboard-help-header">
        <div class="control-toggle active" @click="$emit('toggle')">
          <span>🎮</span>
          <span>禁用键盘控制</span>
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
              <span><kbd class="key">F</kbd></span>
              <span class="key-desc">切换夹爪</span>
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
              <span class="key-desc">上升 / 下降</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">N</kbd> / <kbd class="key">M</kbd></span>
              <span class="key-desc">腕部翻滚</span>
            </div>
            <div class="key-row">
              <span><kbd class="key">;</kbd></span>
              <span class="key-desc">切换夹爪</span>
            </div>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #bdc3c7; color: #7f8c8d; font-size: 13px;">
        <strong>提示：</strong>按下移动键时位置控制会自动激活。
        使用 <kbd class="key">ESC</kbd> 停止系统。
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isKeyboardEnabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle'])
</script>

<style>
/* 样式从全局 styles.css 继承 */
</style>
