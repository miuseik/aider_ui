import * as THREE from 'three'

/**
 * 从 WebXR frame 获取头显姿态数据
 * @param {XRFrame} frame - WebXR frame 对象
 * @param {XRReferenceSpace} referenceSpace - 引用空间
 * @returns {Object|null} 头显数据 { position, quaternion }
 */
export function getHeadsetData(frame, referenceSpace) {
  if (!frame || !referenceSpace) return null
  
  try {
    const viewerPose = frame.getViewerPose(referenceSpace)
    if (viewerPose) {
      return {
        position: {
          x: viewerPose.transform.position.x,
          y: viewerPose.transform.position.y,
          z: viewerPose.transform.position.z
        },
        quaternion: {
          x: viewerPose.transform.orientation.x,
          y: viewerPose.transform.orientation.y,
          z: viewerPose.transform.orientation.z,
          w: viewerPose.transform.orientation.w
        }
      }
    }
  } catch(e) {
    console.warn('Failed to get headset data:', e)
  }
  
  return null
}

/**
 * 从 WebXR input source 获取手柄姿态数据
 * @param {XRInputSource} source - WebXR 输入源
 * @param {XRFrame} frame - WebXR frame 对象
 * @param {XRReferenceSpace} referenceSpace - 引用空间
 * @returns {Object|null} 手柄数据 { position, quaternion }
 */
export function getControllerPose(source, frame, referenceSpace) {
  if (!source || !source.gripSpace || !frame || !referenceSpace) return null
  
  try {
    const pose = frame.getPose(source.gripSpace, referenceSpace)
    if (pose) {
      return {
        position: {
          x: pose.transform.position.x,
          y: pose.transform.position.y,
          z: pose.transform.position.z
        },
        quaternion: {
          x: pose.transform.orientation.x,
          y: pose.transform.orientation.y,
          z: pose.transform.orientation.z,
          w: pose.transform.orientation.w
        }
      }
    }
  } catch(e) {
    console.warn('Failed to get controller pose:', e)
  }
  
  return null
}

/**
 * 从 gamepad 获取摇杆和按钮数据
 * @param {Gamepad} gamepad - Gamepad 对象
 * @returns {Object} 摇杆和按钮数据
 */
export function getControllerInput(gamepad) {
  if (!gamepad) {
    return {
      joystick: { x: 0, y: 0 },
      buttons: []
    }
  }
  
  const data = {
    joystick: { x: 0, y: 0 },
    buttons: []
  }
  
  // 摇杆数据（axes[2] = X, axes[3] = Y）
  if (gamepad.axes && gamepad.axes.length >= 4) {
    data.joystick = {
      x: gamepad.axes[2] || 0,
      y: gamepad.axes[3] || 0
    }
  }
  
  // 所有按钮数据
  if (gamepad.buttons) {
    for (let i = 0; i < gamepad.buttons.length; i++) {
      const btn = gamepad.buttons[i]
      if (btn) {
        data.buttons.push({
          index: i,
          value: btn.value || 0,
          pressed: btn.pressed || false,
          touched: btn.touched || false
        })
      }
    }
  }
  
  return data
}

/**
 * 获取按钮的中文名称映射
 * @param {number} index - 按钮索引
 * @param {string} hand - 手别 ('left' 或 'right')
 * @returns {string} 按钮名称
 */
export function getButtonName(index, hand = 'left') {
  const commonButtons = {
    0: '扳机',
    1: '握把',
    2: '未知',
    3: '摇杆',
    7: '食指接近',
    9: '扳机触摸',
    10: '拇指触摸'
  }
  
  const leftSpecific = {
    4: 'X键',
    5: 'Y键',
    12: 'Menu'
  }
  
  const rightSpecific = {
    4: 'A键',
    5: 'B键'
  }
  
  if (commonButtons[index] !== undefined) {
    return commonButtons[index]
  }
  
  if (hand === 'left' && leftSpecific[index] !== undefined) {
    return leftSpecific[index]
  }
  
  if (hand === 'right' && rightSpecific[index] !== undefined) {
    return rightSpecific[index]
  }
  
  return `[${index}]`
}

/**
 * 从 A-Frame scene 获取完整的 VR 数据
 * @param {HTMLElement} sceneEl - A-Frame scene 元素
 * @param {XRFrame} frame - WebXR frame 对象（可选，如果不提供则尝试从 scene 获取）
 * @returns {Object|null} 完整的 VR 数据
 */
export function getFullVRData(sceneEl, frame = null) {
  if (!sceneEl || !sceneEl.renderer) return null
  
  const session = sceneEl.renderer.xr.getSession()
  if (!session) return null
  
  // 如果没有传入 frame，尝试从 scene 获取
  if (!frame) {
    frame = sceneEl.frame
  }
  
  const referenceSpace = sceneEl.renderer.xr.getReferenceSpace()
  
  if (!frame || !referenceSpace) return null
  
  const result = {
    headset: null,
    leftController: null,
    rightController: null
  }
  
  // 获取头显数据
  result.headset = getHeadsetData(frame, referenceSpace)
  
  // 获取手柄数据
  const sources = session.inputSources
  if (sources) {
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      if (!source.gamepad) continue
      
      const pose = getControllerPose(source, frame, referenceSpace)
      const input = getControllerInput(source.gamepad)
      
      const controllerData = {
        hand: source.handedness,
        position: pose ? pose.position : null,
        quaternion: pose ? pose.quaternion : null,
        joystick: input.joystick,
        buttons: input.buttons
      }
      
      if (source.handedness === 'left') {
        result.leftController = controllerData
      } else if (source.handedness === 'right') {
        result.rightController = controllerData
      }
    }
  }
  
  return result
}
