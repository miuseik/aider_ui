/**
 * 外骨骼相关 API
 * 校准配置走 HTTP（服务端写 exo_calibration.yaml 并通知 Terminal 重载）；
 * 启停/模式切换走 WebSocket（wsClient: exo_toggle / set_control_mode），不在此模块。
 */

import request from './request'

/**
 * 获取全部通道的外骨骼校准配置
 * @returns {Promise<{code:number, message:string, data:Array<{channel:number, arm:string, joint_index:number, joint_name:string, pot_zero:number|null, pot_min:number, pot_max:number, angle_min:number, angle_max:number, reverse:boolean, enabled:boolean}>}>}
 */
export function getExoCalibration() {
  return request.get('/exo/calibration')
}

/**
 * 更新单通道校准（partial update，只传要改的字段，其余服务端 merge）
 * @param {{channel:number, pot_zero?:number|null, pot_min?:number, pot_max?:number, angle_min?:number, angle_max?:number, reverse?:boolean, enabled?:boolean}} data
 */
export function updateExoCalibration(data) {
  return request.post('/exo/calibration', data)
}

/**
 * 一键归零：将当前外骨骼 raw 角度写入所有已启用通道的 pot_zero
 * 摆好外骨骼零位姿态后调用，server 用缓存的最后一帧 exo_data 作为零位参考
 * @returns {Promise<{code:number, message:string, data:{updated_channels:number}}>}
 */
export function exoZero() {
  return request.post('/exo/zero')
}

/**
 * 单通道归零：将指定通道的当前 raw 角度写入其 pot_zero
 * @param {number} channel - 通道号 (0-15)
 */
export function exoZeroChannel(channel) {
  return request.post(`/exo/zero/${channel}`)
}
