/**
 * 机器人控制 API
 */

import request from '@/utils/request'

/**
 * 控制单个电机角度
 * @param {string} arm - 'left' | 'right'
 * @param {string} motor - 电机名称
 * @param {number} angle - 目标角度(度)
 */
export function controlMotor(arm, motor, angle) {
  return request.post('/control_motor', { arm, motor, angle })
}

/**
 * 校准电机零点
 * @param {string} arm - 'left' | 'right'
 * @param {string} motor - 电机名称
 * @param {number} targetZero - 目标零点位置
 */
export function calibrateMotor(arm, motor, targetZero = 0.0) {
  return request.post('/calibrate', { arm, motor, target_zero: targetZero })
}

/**
 * 控制底盘轮子速度
 * @param {string} wheel - 'left' | 'rear' | 'right'
 * @param {number} speed - 速度百分比 (-100 到 100)
 */
export function controlChassis(wheel, speed) {
  return request.post('/control_chassis', { wheel, speed })
}

/**
 * 控制升降轴速度
 * @param {number} speed - 速度百分比 (-100 到 100)
 */
export function controlLift(speed) {
  return request.post('/control_lift', { speed })
}
