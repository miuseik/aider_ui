<template>
  <Layout>
    <div class="vr-container" ref="sceneRef">
      <!-- A-Frame VR 场景 -->
      <a-scene vr-mode-ui="enabled: false;">
        <!-- Passthrough setup -->
        <a-entity webxr-passthrough="referenceSpaceType: local-floor"></a-entity>

        <!-- Controllers -->
        <a-entity id="leftHand" oculus-touch-controls="hand: left">
          <a-text 
            id="leftHandInfo" 
            value="Pos: ...\nRot: ..." 
            position="0 0.04 -0.05" 
            rotation="0 0 0" 
            scale="0.05 0.05 0.05" 
            color="white" 
            align="center"
          ></a-text>
        </a-entity>
        
        <a-entity id="rightHand" oculus-touch-controls="hand: right">
          <a-text 
            id="rightHandInfo" 
            value="Pos: ...\nRot: ..." 
            position="0 0.04 -0.05" 
            rotation="0 0 0" 
            scale="0.05 0.05 0.05" 
            color="white" 
            align="center"
          ></a-text>
        </a-entity>
        
        <!-- 数据中心面板（作为 3D 对象添加到场景中） -->
        <a-entity id="dataPanel" position="0 -0.2 -1.5" rotation="-15 0 0"></a-entity>
        
        <!-- 视频屏幕（3D 对象） -->
        <a-entity id="videoScreen" position="0 1.5 -2" rotation="0 0 0"></a-entity>
      </a-scene>
    </div>
  </Layout>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { wsClient } from '../utils/websocket.js'
import { getFullVRData, getButtonName } from '../utils/vrData.js'
import { createAxisIndicators } from '../utils/vrHelpers.js'
import VideoStreamManager from '../utils/videoStream.js'
import controllerManager from '../utils/controllerManager.js'
import Layout from '../components/Layout.vue'

const sceneRef = ref(null)
let dataPanelMesh = null
let dataPanelContext = null
let dataPanelTexture = null
let animationId = null

// 视频屏幕相关
let videoScreenMesh = null
let videoCanvas = null
let videoContext = null
let videoTexture = null

// 手柄状态
let leftGripDown = false
let rightGripDown = false
let leftTriggerDown = false
let rightTriggerDown = false

// 相对旋转跟踪
let leftGripInitialRotation = null
let rightGripInitialRotation = null
let leftRelativeRotation = { x: 0, y: 0, z: 0 }
let rightRelativeRotation = { x: 0, y: 0, z: 0 }

// Z 轴旋转跟踪
let leftGripInitialQuaternion = null
let rightGripInitialQuaternion = null
let leftZAxisRotation = 0
let rightZAxisRotation = 0

// 视频流
let videoStream = null

onMounted(() => {
  console.log('进入了沉浸模式')

  // 等待 A-Frame 场景初始化
  setTimeout(() => {
    initControllerUpdater()
    initDataPanel()
    initVideoScreen()  // 初始化视频屏幕
    setupRendererAnimationLoop()
    
    // 初始化视频流
    videoStream = new VideoStreamManager()
    videoStream.connect()
  }, 500)
})

onUnmounted(() => {
  const sceneEl = document.querySelector('a-scene')
  if (sceneEl && sceneEl.renderer) {
    sceneEl.renderer.setAnimationLoop(null)
  }
  
  // 清理视频流
  if (videoStream) {
    videoStream.disconnect()
  }
  
  // 清理事件监听器
  cleanupEventListeners()
})

// 初始化工具函数
function calculateRelativeRotation(currentRotation, initialRotation) {
  return {
    x: currentRotation.x - initialRotation.x,
    y: currentRotation.y - initialRotation.y,
    z: currentRotation.z - initialRotation.z
  }
}

function calculateZAxisRotation(currentQuaternion, initialQuaternion) {
  const relativeQuat = new THREE.Quaternion()
  relativeQuat.multiplyQuaternions(currentQuaternion, initialQuaternion.clone().invert())
  
  const forwardDirection = new THREE.Vector3(0, 0, 1)
  forwardDirection.applyQuaternion(currentQuaternion)
  
  const angle = 2 * Math.acos(Math.abs(relativeQuat.w))
  if (angle < 0.0001) return 0
  
  const sinHalfAngle = Math.sqrt(1 - relativeQuat.w * relativeQuat.w)
  const rotationAxis = new THREE.Vector3(
    relativeQuat.x / sinHalfAngle,
    relativeQuat.y / sinHalfAngle,
    relativeQuat.z / sinHalfAngle
  )
  
  const projectedComponent = rotationAxis.dot(forwardDirection)
  const forwardRotation = angle * projectedComponent
  let degrees = THREE.MathUtils.radToDeg(forwardRotation)
  
  while (degrees > 180) degrees -= 360
  while (degrees < -180) degrees += 360
  
  return degrees
}

function sendGripRelease(hand) {
  if (wsClient.isConnected) {
    wsClient.send(JSON.stringify({ hand, gripReleased: true }))
  }
}

function sendTriggerRelease(hand) {
  if (wsClient.isConnected) {
    wsClient.send(JSON.stringify({ hand, triggerReleased: true }))
  }
}

// 设置事件监听器
function setupEventListeners(leftHand, rightHand) {
  // 左手事件
  leftHand.addEventListener('triggerdown', () => {
    leftTriggerDown = true
  })
  leftHand.addEventListener('triggerup', () => {
    leftTriggerDown = false
    sendTriggerRelease('left')
  })
  leftHand.addEventListener('gripdown', () => {
    leftGripDown = true
    if (leftHand.object3D.visible) {
      const rot = leftHand.object3D.rotation
      leftGripInitialRotation = {
        x: THREE.MathUtils.radToDeg(rot.x),
        y: THREE.MathUtils.radToDeg(rot.y),
        z: THREE.MathUtils.radToDeg(rot.z)
      }
      leftGripInitialQuaternion = leftHand.object3D.quaternion.clone()
    }
  })
  leftHand.addEventListener('gripup', () => {
    leftGripDown = false
    leftGripInitialRotation = null
    leftGripInitialQuaternion = null
    leftRelativeRotation = { x: 0, y: 0, z: 0 }
    leftZAxisRotation = 0
    sendGripRelease('left')
  })
  
  // 右手事件
  rightHand.addEventListener('triggerdown', () => {
    rightTriggerDown = true
  })
  rightHand.addEventListener('triggerup', () => {
    rightTriggerDown = false
    sendTriggerRelease('right')
  })
  rightHand.addEventListener('gripdown', () => {
    rightGripDown = true
    if (rightHand.object3D.visible) {
      const rot = rightHand.object3D.rotation
      rightGripInitialRotation = {
        x: THREE.MathUtils.radToDeg(rot.x),
        y: THREE.MathUtils.radToDeg(rot.y),
        z: THREE.MathUtils.radToDeg(rot.z)
      }
      rightGripInitialQuaternion = rightHand.object3D.quaternion.clone()
    }
  })
  rightHand.addEventListener('gripup', () => {
    rightGripDown = false
    rightGripInitialRotation = null
    rightGripInitialQuaternion = null
    rightRelativeRotation = { x: 0, y: 0, z: 0 }
    rightZAxisRotation = 0
    sendGripRelease('right')
  })
}

function cleanupEventListeners() {
  const leftHand = document.querySelector('#leftHand')
  const rightHand = document.querySelector('#rightHand')
  if (leftHand) leftHand.removeEventListener('gripdown', null)
  if (rightHand) rightHand.removeEventListener('gripdown', null)
}

// 初始化控制器更新器
function initControllerUpdater() {
  const leftHand = document.querySelector('#leftHand')
  const rightHand = document.querySelector('#rightHand')
  const leftHandInfoText = document.querySelector('#leftHandInfo')
  const rightHandInfoText = document.querySelector('#rightHandInfo')
  
  if (!leftHand || !rightHand || !leftHandInfoText || !rightHandInfoText) {
    console.error('未找到控制器或文本实体！')
    return
  }
  
  // 应用初始旋转
  const textRotation = '-90 0 0'
  leftHandInfoText.setAttribute('rotation', textRotation)
  rightHandInfoText.setAttribute('rotation', textRotation)
  
  // 创建坐标轴指示器
  createAxisIndicators(leftHand, '左')
  createAxisIndicators(rightHand, '右')
  
  // 设置事件监听器
  setupEventListeners(leftHand, rightHand)
}

// 发送 VR 数据到后端
function sendVRData(vrData) {
  if (!(leftGripDown || rightGripDown) || !wsClient.isConnected || !vrData) {
    return
  }
  
  const dualControllerData = {
    timestamp: Date.now(),
    headset: vrData?.headset || {
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    },
    leftController: vrData?.leftController ? {
      hand: 'left',
      position: vrData.leftController.position,
      quaternion: vrData.leftController.quaternion,
      gripActive: leftGripDown,
      trigger: vrData.leftController.buttons[0]?.value || 0,
      joystick: vrData.leftController.joystick,
      // buttons: vrData.leftController.buttons
    } : {
      hand: 'left',
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      gripActive: false,
      trigger: 0,
      joystick: { x: 0, y: 0 },
      // buttons: []
    },
    rightController: vrData?.rightController ? {
      hand: 'right',
      position: vrData.rightController.position,
      quaternion: vrData.rightController.quaternion,
      gripActive: rightGripDown,
      trigger: vrData.rightController.buttons[0]?.value || 0,
      joystick: vrData.rightController.joystick,
      // buttons: vrData.rightController.buttons
    } : {
      hand: 'right',
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      gripActive: false,
      trigger: 0,
      joystick: { x: 0, y: 0 },
      // buttons: []
    }
  }
  
  wsClient.send(JSON.stringify(dualControllerData))
}

// 重启系统
async function restartSystem() {
  try {
    await fetch('/api/restart', {
      method: 'POST'
    })
    // 3秒后刷新页面
    setTimeout(() => {
      window.location.reload()
    }, 5000)
  } catch (err) {
    // 即使请求失败也刷新
    setTimeout(() => {
      window.location.reload()
    }, 5000)
  }
}

// 初始化数据面板（创建 3D 对象）
function initDataPanel() {
  const dataPanelEntity = document.querySelector('#dataPanel')
  if (!dataPanelEntity) return
  
  // 创建 canvas
  const canvas = document.createElement('canvas')
  canvas.width = 3840
  canvas.height = 1200
  
  dataPanelContext = canvas.getContext('2d')
  
  // 创建纹理
  dataPanelTexture = new THREE.CanvasTexture(canvas)
  dataPanelTexture.minFilter = THREE.LinearFilter
  dataPanelTexture.magFilter = THREE.LinearFilter
  
  // 创建几何体和材质
  const geometry = new THREE.PlaneGeometry(3.0, 0.95)
  const material = new THREE.MeshBasicMaterial({
    map: dataPanelTexture,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })
  
  // 创建网格并添加到实体
  dataPanelMesh = new THREE.Mesh(geometry, material)
  dataPanelMesh.renderOrder = 1000
  dataPanelEntity.object3D.add(dataPanelMesh)
}

// 初始化视频屏幕（创建 3D 对象）
function initVideoScreen() {
  const videoScreenEntity = document.querySelector('#videoScreen')
  if (!videoScreenEntity) return
  
  // 创建 canvas
  videoCanvas = document.createElement('canvas')
  videoCanvas.width = 640
  videoCanvas.height = 480
  
  videoContext = videoCanvas.getContext('2d')
  
  // 创建纹理
  videoTexture = new THREE.CanvasTexture(videoCanvas)
  videoTexture.minFilter = THREE.LinearFilter
  videoTexture.magFilter = THREE.LinearFilter
  
  // 创建几何体和材质
  const geometry = new THREE.PlaneGeometry(1.6, 0.9)  // 16:9 比例
  const material = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.DoubleSide
  })
  
  // 创建网格并添加到实体
  videoScreenMesh = new THREE.Mesh(geometry, material)
  videoScreenEntity.object3D.add(videoScreenMesh)
}

// 设置 renderer 的 animation loop
function setupRendererAnimationLoop() {
  const sceneEl = document.querySelector('a-scene')
  if (!sceneEl || !sceneEl.renderer) return
  
  // 监听场景的 enter-vr 事件，在进入 VR 时开始更新数据面板
  sceneEl.addEventListener('enter-vr', () => {
    if (!sceneEl.hasAttribute('data-panel-updater')) {
      sceneEl.setAttribute('data-panel-updater', '')
      
      // 创建自定义组件来更新数据面板
      AFRAME.registerComponent('data-panel-updater', {
        tick: function() {
          if (sceneEl.renderer.xr.isPresenting) {
            const frame = sceneEl.frame
            if (frame) {
              const referenceSpace = sceneEl.renderer.xr.getReferenceSpace()
              const session = sceneEl.renderer.xr.getSession()
              
              // 计算相对旋转
              updateRelativeRotation()
              
              updateDataPanelInFrame(0, frame, referenceSpace, session)
              updateVideoScreenInFrame()  // 更新视频屏幕
            }
          }
        }
      })
    }
  })
}

// 更新相对旋转
function updateRelativeRotation() {
  const leftHand = document.querySelector('#leftHand')
  const rightHand = document.querySelector('#rightHand')
  const leftHandInfoText = document.querySelector('#leftHandInfo')
  const rightHandInfoText = document.querySelector('#rightHandInfo')
  
  if (!leftHand || !rightHand) return
  
  // 左手相对旋转
  if (leftGripDown && leftGripInitialRotation && leftHand.object3D.visible) {
    const rot = leftHand.object3D.rotation
    const currentRot = {
      x: THREE.MathUtils.radToDeg(rot.x),
      y: THREE.MathUtils.radToDeg(rot.y),
      z: THREE.MathUtils.radToDeg(rot.z)
    }
    leftRelativeRotation = calculateRelativeRotation(currentRot, leftGripInitialRotation)
    
    if (leftGripInitialQuaternion) {
      leftZAxisRotation = calculateZAxisRotation(
        leftHand.object3D.quaternion,
        leftGripInitialQuaternion
      )
    }
    
    // 更新左手文本显示
    if (leftHandInfoText) {
      const pos = leftHand.object3D.position
      let text = `Pos: ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}\n`
      text += `Rot: ${currentRot.x.toFixed(0)} ${currentRot.y.toFixed(0)} ${currentRot.z.toFixed(0)}\n`
      text += `Z-Rot: ${leftZAxisRotation.toFixed(1)}°`
      leftHandInfoText.setAttribute('value', text)
    }
  }
  
  // 右手相对旋转
  if (rightGripDown && rightGripInitialRotation && rightHand.object3D.visible) {
    const rot = rightHand.object3D.rotation
    const currentRot = {
      x: THREE.MathUtils.radToDeg(rot.x),
      y: THREE.MathUtils.radToDeg(rot.y),
      z: THREE.MathUtils.radToDeg(rot.z)
    }
    rightRelativeRotation = calculateRelativeRotation(currentRot, rightGripInitialRotation)
    
    if (rightGripInitialQuaternion) {
      rightZAxisRotation = calculateZAxisRotation(
        rightHand.object3D.quaternion,
        rightGripInitialQuaternion
      )
    }
    
    // 更新右手文本显示
    if (rightHandInfoText) {
      const pos = rightHand.object3D.position
      let text = `Pos: ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}\n`
      text += `Rot: ${currentRot.x.toFixed(0)} ${currentRot.y.toFixed(0)} ${currentRot.z.toFixed(0)}\n`
      text += `Z-Rot: ${rightZAxisRotation.toFixed(1)}°`
      rightHandInfoText.setAttribute('value', text)
    }
  }
}

// 在 WebXR frame 中更新数据面板
function updateDataPanelInFrame(time, frame, referenceSpace, session) {
  if (!dataPanelContext || !dataPanelTexture) return
  if (!frame || !referenceSpace || !session) return
  
  const ctx = dataPanelContext
  const canvas = dataPanelTexture.image
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // 边框
  ctx.strokeStyle = '#00ffff'
  ctx.lineWidth = 8
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  
  // 标题
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 70px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('◈ DATA CENTER ◈', canvas.width / 2, 90)
  
  // 获取完整的 VR 数据
  const sceneEl = document.querySelector('a-scene')
  const vrData = getFullVRData(sceneEl, frame)
  
  // 发送数据到后端
  sendVRData(vrData)

  // 显示头显数据
  let headsetPos = 'N/A'
  let headsetRot = 'N/A'
  if (vrData && vrData.headset) {
    const pos = vrData.headset.position
    const quat = vrData.headset.quaternion
    headsetPos = `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    headsetRot = `${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}`
  }
  
  // 头显信息 - 顶部
  ctx.textAlign = 'center'
  ctx.fillStyle = '#00ff88'
  ctx.font = 'bold 55px monospace'
  ctx.fillText('HEADSET', canvas.width / 2, 170)
  
  ctx.fillStyle = '#ffffff'
  ctx.font = '45px monospace'
  ctx.fillText('POS: ' + headsetPos, canvas.width / 2, 230)
  ctx.fillText('ROT: ' + headsetRot, canvas.width / 2, 280)
  
  // 显示左手柄数据
  displayControllerData(ctx, canvas, vrData?.leftController, 'left', 100)
  
  // 显示右手柄数据
  displayControllerData(ctx, canvas, vrData?.rightController, 'right', canvas.width - 100)
  
  // 更新纹理
  dataPanelTexture.needsUpdate = true
}

// 显示单个手柄数据
function displayControllerData(ctx, canvas, controller, hand, xPos) {
  const isLeft = hand === 'left'
  
  // 标题
  ctx.textAlign = isLeft ? 'left' : 'right'
  ctx.fillStyle = isLeft ? '#00ff88' : '#ff6688'
  ctx.font = 'bold 65px monospace'
  ctx.shadowBlur = 30
  ctx.shadowColor = isLeft ? '#00ff88' : '#ff6688'
  ctx.fillText(isLeft ? '◈ LEFT ◈' : '◈ RIGHT ◈', xPos, 150)
  ctx.shadowBlur = 0
  
  if (!controller) {
    // 未检测到手柄
    ctx.fillStyle = '#666666'
    ctx.font = '42px monospace'
    ctx.fillText(isLeft ? '未检测到左手柄' : '未检测到右手柄', xPos, 210)
    return
  }
  // 检测左手 menu 键 (button 12)
  if (controller.buttons[12]?.pressed) {
    restartSystem()
    return
  }
  // 位置和旋转
  let posText = 'POS: 0.00, 0.00, 0.00'
  let rotText = 'ROT: 0.00, 0.00, 0.00'
  if (controller.position && controller.quaternion) {
    const pos = controller.position
    const quat = controller.quaternion
    posText = `POS: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    rotText = `ROT: ${quat.x.toFixed(2)}, ${quat.y.toFixed(2)}, ${quat.z.toFixed(2)}`
  }
  
  ctx.fillStyle = isLeft ? '#00ffcc' : '#ff99aa'
  ctx.font = '42px monospace'
  ctx.fillText(posText, xPos, 200)
  ctx.fillText(rotText, xPos, 250)
  
  // 摇杆数据
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 48px monospace'
  ctx.shadowBlur = 20
  ctx.shadowColor = '#00ffff'
  const joyX = controller.joystick.x.toFixed(2)
  const joyY = controller.joystick.y.toFixed(2)
  ctx.fillText(`JOY: ${joyX}, ${joyY}`, xPos, 310)
  ctx.shadowBlur = 0
  
  // 按钮信息
  ctx.fillStyle = '#ffffff'
  ctx.font = '45px monospace'
  
  let yPos = 370
  for (let i = 0; i < controller.buttons.length && yPos < 1150; i++) {
    const btn = controller.buttons[i]
    const name = getButtonName(btn.index, hand)
    const value = btn.value.toFixed(2)
    const text = `${name}: ${value}`
    
    // 根据值设置颜色
    if (btn.value > 0.5) {
      ctx.fillStyle = '#ff6600'
      ctx.shadowBlur = 20
      ctx.shadowColor = '#ff6600'
    } else if (btn.value > 0) {
      ctx.fillStyle = '#ffaa00'
      ctx.shadowBlur = 10
      ctx.shadowColor = '#ffaa00'
    } else {
      ctx.fillStyle = '#666666'
      ctx.shadowBlur = 0
    }
    
    ctx.fillText(text, xPos, yPos)
    yPos += 50
  }
  ctx.shadowBlur = 0
}

// 在 WebXR frame 中更新视频屏幕
function updateVideoScreenInFrame() {
  if (!videoContext || !videoTexture) return
  
  // 获取最新的视频帧
  const frameImage = videoStream ? videoStream.getLatestFrameImage() : null
  
  if (frameImage && frameImage.complete && frameImage.naturalWidth > 0) {
    try {
      // 清空画布
      videoContext.clearRect(0, 0, videoCanvas.width, videoCanvas.height)
      
      // 绘制视频帧（铺满整个屏幕）
      videoContext.drawImage(frameImage, 0, 0, videoCanvas.width, videoCanvas.height)
      
      // 标记纹理需要更新
      videoTexture.needsUpdate = true
    } catch (e) {
      // 静默失败
    }
  }
}
</script>

<style scoped>
.vr-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
  z-index: 10;
}
</style>
