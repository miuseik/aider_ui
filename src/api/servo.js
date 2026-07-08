/**
 * 舵机管理 API
 */

import request from '@/api/request.js'

/**
 * 获取舵机 ID 配置
 */
export function getServoIds() {
  return request.post('/get-servo-ids')
}

/**
 * 保存舵机 ID 配置
 * @param {Object} data - 配置数据
 */
export function putServoIds(data) {
  return request.post('/put-servo-ids', data)
}

/**
 * 扫描舵机
 * @param {string} port - 串口路径
 * @param {number} startId - 起始 ID
 * @param {number} endId - 结束 ID
 */
export function scanServos(port, startId = 1, endId = 253) {
  return request.post('/scan_servos', { port, start_id: startId, end_id: endId })
}

/**
 * Ping 舵机
 * @param {number} servoId - 舵机 ID
 * @param {string} port - 串口路径
 */
export function pingServo(servoId, port) {
  return request.post('/ping', { servo_id: servoId, port })
}

/**
 * 设置舵机角度
 * @param {number} servoId - 舵机 ID
 * @param {number} angle - 角度
 * @param {string} port - 串口路径
 */
export function setServoAngle(servoId, angle, port) {
  return request.post('/servo/set_angle', { servo_id: servoId, angle, port })
}

/**
 * 设置舵机速度
 * @param {number} servoId - 舵机 ID
 * @param {number} speed - 速度
 * @param {string} port - 串口路径
 */
export function setServoSpeed(servoId, speed, port) {
  return request.post('/servo/set_speed', { servo_id: servoId, speed, port })
}

/**
 * 设置舵机模式
 * @param {number} servoId - 舵机 ID
 * @param {number} mode - 模式
 * @param {string} port - 串口路径
 */
export function setServoMode(servoId, mode, port) {
  return request.post('/servo/set_mode', { servo_id: servoId, mode, port })
}

/**
 * 重置舵机
 * @param {number} servoId - 舵机 ID
 * @param {string} port - 串口路径
 */
export function resetServo(servoId, port) {
  return request.post('/servo/reset', { servo_id: servoId, port })
}

/**
 * 设置舵机 ID
 * @param {number} oldId - 旧 ID
 * @param {number} newId - 新 ID
 * @param {string} port - 串口路径
 */
export function setServoId(oldId, newId, port) {
  return request.post('/servo/set_id', { old_id: oldId, new_id: newId, port })
}

/**
 * 获取舵机信息
 * @param {number} servoId - 舵机 ID
 * @param {string} port - 串口路径
 */
export function getServoInfo(servoId, port) {
  return request.post('/servo/get_info', { servo_id: servoId, port })
}

/**
 * 列出可用串口
 */
export function listPorts() {
  return request.get('/list_ports')
}

/**
 * 设置舵机零点（将当前位置设为0，保存到Flash）
 * @param {number} servoId - 舵机 ID
 * @param {string} port - 串口/CAN 端口路径
 */
export function setServoZero(servoId, port) {
  return request.post('/servo/calibrate', { servo_id: servoId, port })
}

/**
 * 批量设置所有电机零点（将当前位置设为 0，写入 Flash）
 * 用于 RobStride 等非 Feetech 电机：摆好期望零位后一键标零。
 * @param {string} port - CAN 端口路径，默认 'can0'
 */
export function batchSetServoZero(port) {
  return request.post('/servo/batch-calibrate-zero', { port })
}

/**
 * 触发 Terminal 批量校准所有舵机零位偏移量
 * Terminal 读取编码器位置 → 反算 zero_offset → 即时生效 → 写回 YAML
 * @param {string} port - 可选，不传则校准所有端口
 */
export function startBatchCalibrate(port) {
  return request.post('/servo/start-batch-calibrate', { port })
}

/**
 * 触发 Terminal 校准单个舵机的零位偏移量
 * @param {number} servoId - 舵机 ID
 * @param {string} port - 串口路径
 */
export function calibrateSingleOffset(servoId, port) {
  return request.post('/servo/calibrate-offset', { servo_id: servoId, port })
}
