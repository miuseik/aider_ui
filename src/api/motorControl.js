/**
 * 电机控制 API
 * 提供电机角度控制、校准、底盘和升降轴控制接口
 */

import axios from 'axios'

// API 基础 URL
const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || ''
}

/**
 * 控制单个电机角度
 * @param {string} arm - 'left' 或 'right'
 * @param {string} motorName - 电机名称 (shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper)
 * @param {number} angle - 目标角度(度)
 * @returns {Promise<Object>} 响应数据
 */
export async function controlMotor(arm, motorName, angle) {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/control_motor`, {
      arm,
      motor: motorName,
      angle: angle
    })
    return response.data
  } catch (error) {
    console.error('控制电机失败:', error)
    throw error
  }
}

/**
 * 校准电机零点
 * @param {string} arm - 'left' 或 'right'
 * @param {string} motorName - 电机名称
 * @param {number} targetZero - 目标零点位置(默认0.0)
 * @returns {Promise<Object>} 响应数据
 */
export async function calibrateMotor(arm, motorName, targetZero = 0.0) {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/calibrate`, {
      arm,
      motor: motorName,
      target_zero: targetZero
    })
    return response.data
  } catch (error) {
    console.error('校准电机失败:', error)
    throw error
  }
}

/**
 * 控制底盘轮子速度
 * @param {string} wheel - 'left', 'rear', 或 'right'
 * @param {number} speed - 速度百分比 (-100 到 100)
 * @returns {Promise<Object>} 响应数据
 */
export async function controlChassis(wheel, speed) {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/control_chassis`, {
      wheel,
      speed: speed
    })
    return response.data
  } catch (error) {
    console.error('控制底盘失败:', error)
    throw error
  }
}

/**
 * 控制升降轴速度
 * @param {number} speed - 速度百分比 (-100 到 100)
 * @returns {Promise<Object>} 响应数据
 */
export async function controlLift(speed) {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/control_lift`, {
      speed: speed
    })
    return response.data
  } catch (error) {
    console.error('控制升降轴失败:', error)
    throw error
  }
}
