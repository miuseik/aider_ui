<template>
  <div class="card robot-hardware-card">
    <div class="robot-header">
      <h3>🤖 机器人硬件信息</h3>
    </div>
    <div class="robot-layout" v-if="robotConfig">
      <div class="robot-column left">
        <RobotPart 
          title="左胳膊"
          :servos="getPartServos(robotConfig.left_arm)"
          part-name="left_arm"
          :scanning="scanning"
          @claim="(idx) => $emit('claim', 'left_arm', idx)"
          @ping="(idx) => $emit('ping', 'left_arm', idx)"
          @calibrate="(idx) => $emit('calibrate', 'left_arm', idx)"
          @update-angle="$emit('update-angle', $event)"
        />
      </div>

      <div class="robot-column center">
        <RobotPart 
          title="头"
          :servos="[]"
          part-name="head"
          :scanning="scanning"
        />
        <RobotPart 
          title="脖子"
          :servos="getPartServos(robotConfig.neck)"
          part-name="neck"
          :scanning="scanning"
          @claim="(idx) => $emit('claim', 'neck', idx)"
          @ping="(idx) => $emit('ping', 'neck', idx)"
          @calibrate="(idx) => $emit('calibrate', 'neck', idx)"
          @update-angle="$emit('update-angle', $event)"
        />
        <RobotPart 
          title="身体"
          :servos="getPartServos(robotConfig.lift_axis)"
          part-name="lift_axis"
          :scanning="scanning"
          @claim="(idx) => $emit('claim', 'lift_axis', idx)"
          @ping="(idx) => $emit('ping', 'lift_axis', idx)"
          @calibrate="(idx) => $emit('calibrate', 'lift_axis', idx)"
          @update-angle="$emit('update-angle', $event)"
        />
        <RobotPart 
          title="底盘"
          :servos="getPartServos(robotConfig.base)"
          part-name="base"
          :scanning="scanning"
          @claim="(idx) => $emit('claim', 'base', idx)"
          @ping="(idx) => $emit('ping', 'base', idx)"
          @calibrate="(idx) => $emit('calibrate', 'base', idx)"
          @update-angle="$emit('update-angle', $event)"
        />
      </div>

      <div class="robot-column right">
        <RobotPart 
          title="右胳膊"
          :servos="getPartServos(robotConfig.right_arm)"
          part-name="right_arm"
          :scanning="scanning"
          @claim="(idx) => $emit('claim', 'right_arm', idx)"
          @ping="(idx) => $emit('ping', 'right_arm', idx)"
          @calibrate="(idx) => $emit('calibrate', 'right_arm', idx)"
          @update-angle="$emit('update-angle', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import RobotPart from './RobotPart.vue'

defineProps({
  robotConfig: { type: Object, default: null },
  scanning: { type: Boolean, default: false },
})

defineEmits(['claim', 'ping', 'calibrate', 'update-angle'])

function getPartServos(partConfig) {
  if (!partConfig) return []
  if (typeof partConfig === 'object' && !Array.isArray(partConfig)) {
    return partConfig
  }
  return []
}
</script>

<style scoped>
.card {
  background: #1e2128;
  border: 1px solid #2d3139;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}
.robot-hardware-card {
  margin-top: 20px;
}
.robot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.robot-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}
.robot-layout {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: flex-start;
}
.robot-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  max-width: 300px;
}
.robot-column.center {
  flex: 1.5;
}
</style>
