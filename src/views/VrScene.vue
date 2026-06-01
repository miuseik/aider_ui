<template>
    <div class="vr-container" ref="sceneRef">
      <!-- 视频显示区域 - 复用 ARTC 组件（全屏） -->
      <VideoStreamARTC
        video-id="vr-scene-video"
        label="VR 场景视频"
        :is-online="true"
        @connected="handleVideoConnected"
        @disconnected="handleVideoDisconnected"
        class="vr-scene-video"
      />
      
      <!-- A-Frame VR 场景根节点,隐藏默认VR按钮 -->
      <a-scene vr-mode-ui="enabled: true;">
        <!-- 开启透视模式(MR混合现实),能看到真实环境+虚拟内容 -->
        <a-entity webxr-passthrough="referenceSpaceType: local-floor"></a-entity>

        <!-- 左手控制器(追踪 Meta Quest 左手柄位置和按键) -->
        <a-entity id="leftHand" oculus-touch-controls="hand: left">
          <!-- 手柄上显示的文本信息(位置/旋转数据),相对手柄:上方4cm,前方5cm,缩小到5% -->
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
        
        <!-- 右手控制器(追踪 Meta Quest 右手柄位置和按键) -->
        <a-entity id="rightHand" oculus-touch-controls="hand: right">
          <!-- 手柄上显示的文本信息(位置/旋转数据),相对手柄:上方4cm,前方5cm,缩小到5% -->
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
        
        <!-- 数据中心面板容器(显示VR数据的3D屏幕,在面前1.5米处,向下倾斜15度) -->
        <a-entity id="dataPanel" position="0 -0.2 -1.5" rotation="-15 0 0"></a-entity>
      </a-scene>
    </div>
</template>

<script setup>
// ========== 导入依赖 ==========
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { wsClient } from '../utils/websocket.js'           // WebSocket 客户端
import { getFullVRData, getButtonName } from '../utils/vrData.js'  // VR 数据工具
import { createAxisIndicators } from '../utils/vrHelpers.js'       // 坐标轴指示器
import VideoStreamARTC from '../components/VideoStreamARTC.vue'    // ARTC 视频组件

// ========== 响应式变量 ==========
const sceneRef = ref(null)  // A-Frame 场景引用
const videoConnected = ref(false)

// 数据中心面板相关
let dataPanelMesh = null         // 3D 网格对象
let dataPanelContext = null      // Canvas 2D 上下文
let dataPanelTexture = null      // Canvas 纹理
let animationId = null           // 动画帧 ID

// ========== 手柄状态 ==========
let leftGripDown = false       // 左手握把按下
let rightGripDown = false      // 右手握把按下
let leftTriggerDown = false    // 左手扳机按下
let rightTriggerDown = false   // 右手扳机按下

// 相对旋转跟踪(用于计算握把按下时的相对角度变化)
let leftGripInitialRotation = null      // 左手初始旋转
let rightGripInitialRotation = null     // 右手初始旋转
let leftRelativeRotation = { x: 0, y: 0, z: 0 }   // 左手相对旋转
let rightRelativeRotation = { x: 0, y: 0, z: 0 }  // 右手相对旋转

// Z 轴旋转跟踪(绕前向轴的旋转角度)
let leftGripInitialQuaternion = null    // 左手初始四元数
let rightGripInitialQuaternion = null   // 右手初始四元数
let leftZAxisRotation = 0               // 左手 Z 轴旋转角度
let rightZAxisRotation = 0              // 右手 Z 轴旋转角度

// ========== 生命周期钩子 ==========
onMounted(() => {
  console.log('进入了沉浸模式')

  // 等待 A-Frame 场景初始化
  setTimeout(() => {
    initControllerUpdater()      // 初始化手柄控制器(监听按键、创建坐标轴指示器)
    initDataPanel()              // 初始化数据中心面板(CanvasTexture显示VR数据)
    setupRendererAnimationLoop() // 设置渲染循环(每帧更新数据面板和视频纹理)
  }, 500)
})

onUnmounted(() => {
  // 停止渲染循环
  const sceneEl = document.querySelector('a-scene')
  if (sceneEl && sceneEl.renderer) {
    sceneEl.renderer.setAnimationLoop(null)
  }
  
  // 清理事件监听器
  cleanupEventListeners()
})

// ========== 视频事件处理 ==========
function handleVideoConnected() {
  videoConnected.value = true
  console.log('[VrScene] 视频已连接')
}

function handleVideoDisconnected() {
  videoConnected.value = false
  console.log('[VrScene] 视频已断开')
}

// ========== 工具函数 ==========
// 计算相对旋转(当前旋转 - 初始旋转)
function calculateRelativeRotation(currentRotation, initialRotation) {
  return {
    x: currentRotation.x - initialRotation.x,
    y: currentRotation.y - initialRotation.y,
    z: currentRotation.z - initialRotation.z
  }
}

// 计算绕 Z 轴(前向轴)的旋转角度
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

// 发送握把释放信号到后端
function sendGripRelease(hand) {
  if (wsClient.isConnected) {
    wsClient.send(JSON.stringify({ hand, gripReleased: true }))
  }
}

// 发送扳机释放信号到后端
function sendTriggerRelease(hand) {
  if (wsClient.isConnected) {
    wsClient.send(JSON.stringify({ hand, triggerReleased: true }))
  }
}

// ========== 事件监听器 ==========
// 设置手柄事件监听器(trigger/grip 按下/释放)
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
    // 记录握把按下时的初始旋转
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
    // 重置初始值
    leftGripInitialRotation = null
    leftGripInitialQuaternion = null
    leftRelativeRotation = { x: 0, y: 0, z: 0 }
    leftZAxisRotation = 0
    sendGripRelease('left')
  })
  
  // 右手事件(同左手)
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

// 清理事件监听器
function cleanupEventListeners() {
  const leftHand = document.querySelector('#leftHand')
  const rightHand = document.querySelector('#rightHand')
  if (leftHand) leftHand.removeEventListener('gripdown', null)
  if (rightHand) rightHand.removeEventListener('gripdown', null)
}

// ========== 初始化函数 ==========
// 初始化控制器更新器(设置文本旋转、创建坐标轴、绑定事件)
function initControllerUpdater() {
  const leftHand = document.querySelector('#leftHand')
  const rightHand = document.querySelector('#rightHand')
  const leftHandInfoText = document.querySelector('#leftHandInfo')
  const rightHandInfoText = document.querySelector('#rightHandInfo')
  
  if (!leftHand || !rightHand || !leftHandInfoText || !rightHandInfoText) {
    console.error('未找到控制器或文本实体！')
    return
  }
  
  // 应用初始旋转(让文本朝向用户)
  const textRotation = '-90 0 0'
  leftHandInfoText.setAttribute('rotation', textRotation)
  rightHandInfoText.setAttribute('rotation', textRotation)
  
  // 创建坐标轴指示器(XYZ 轴可视化)
  createAxisIndicators(leftHand, '左')
  createAxisIndicators(rightHand, '右')
  
  // 设置事件监听器
  setupEventListeners(leftHand, rightHand)
}

// ========== 数据发送 ==========
// 发送 VR 数据到后端(头显+双手柄的位置/旋转/按键)
function sendVRData(vrData) {
  // 只在握把按下且 WebSocket 连接时发送
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
    } : {
      hand: 'left',
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      gripActive: false,
      trigger: 0,
      joystick: { x: 0, y: 0 },
    },
    rightController: vrData?.rightController ? {
      hand: 'right',
      position: vrData.rightController.position,
      quaternion: vrData.rightController.quaternion,
      gripActive: rightGripDown,
      trigger: vrData.rightController.buttons[0]?.value || 0,
      joystick: vrData.rightController.joystick,
    } : {
      hand: 'right',
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      gripActive: false,
      trigger: 0,
      joystick: { x: 0, y: 0 },
    }
  }
  
  wsClient.send(JSON.stringify(dualControllerData))
}

// 重启系统(调用后端 API,5秒后刷新页面)
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

// ========== 3D 对象初始化 ==========
// 初始化数据面板(创建 CanvasTexture 显示 VR 数据)
function initDataPanel() {
  const dataPanelEntity = document.querySelector('#dataPanel')
  if (!dataPanelEntity) return
  
  // 创建高分辨率 canvas (3840x1200)
  const canvas = document.createElement('canvas')
  canvas.width = 3840
  canvas.height = 1200
  
  dataPanelContext = canvas.getContext('2d')
  
  // 创建纹理
  dataPanelTexture = new THREE.CanvasTexture(canvas)
  dataPanelTexture.minFilter = THREE.LinearFilter
  dataPanelTexture.magFilter = THREE.LinearFilter
  
  // 创建几何体和材质(3.0m x 0.95m 平面)
  const geometry = new THREE.PlaneGeometry(3.0, 0.95)
  const material = new THREE.MeshBasicMaterial({
    map: dataPanelTexture,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,   // 禁用深度测试,始终显示在最前
    depthWrite: false
  })
  
  // 创建网格并添加到实体
  dataPanelMesh = new THREE.Mesh(geometry, material)
  dataPanelMesh.renderOrder = 1000  // 高渲染优先级
  dataPanelEntity.object3D.add(dataPanelMesh)
}

// 初始化视频屏幕(创建 VideoTexture 显示 WebRTC 视频)
function initVideoScreen() {
  const videoScreenEntity = document.querySelector('#videoScreen')
  if (!videoScreenEntity) return
  
  // 创建 video 元素(隐藏,仅作为纹理源)
  videoElement = document.createElement('video')
  videoElement.id = 'video-screen-video'
  videoElement.autoplay = true
  videoElement.playsInline = true
  // videoElement.style.display = 'none'  // 隐藏 DOM 中的 video
  document.body.appendChild(videoElement)
  
  // 创建视频屏幕 3D 网格(1.6m x 0.9m)
  const { mesh, texture } = createVideoScreen(videoElement)
  videoScreenMesh = mesh
  videoScreenEntity.object3D.add(videoScreenMesh)
}

// ========== 视频控制 ==========
// 连接视频(初始化 WebRTC)
function connectVideo() {
  if (videoConnected) return  // 已连接则忽略
  
  console.log('🎬 开始连接 VR 视频...')
  
  videoManager = new WebRTCVideoManager({
    videoId: 'video-screen-video',
    wsUrl: WS_URL,
    onConnected: () => {
      console.log('✅ VR 视频已连接')
      videoConnected = true
      
      // 视频连接后,重新绑定纹理确保更新
      setTimeout(() => {
        if (videoScreenMesh && videoElement) {
          const { texture } = createVideoScreen(videoElement)
          videoScreenMesh.material.map = texture
          videoScreenMesh.material.needsUpdate = true
          console.log('🔄 视频纹理已重新绑定')
        }
      }, 100)
    },
    onDisconnected: () => {
      console.log('❌ VR 视频已断开')
      videoConnected = false
    },
    onError: (error) => {
      console.error('VR 视频错误:', error)
    }
  })
  
  videoManager.init()
}

// 切换视频连接(连接/断开)
function toggleVideo() {
  if (videoConnected) {
    // 断开连接
    if (videoManager) {
      videoManager.cleanup()
      videoManager = null
    }
    videoConnected = false
    console.log('⏸ 视频已断开')
  } else {
    // 连接视频
    connectVideo()
  }
}

// 调试:显示视频元素到屏幕左上角(检查视频流是否正常)
function showDebugVideo() {
  const video = document.getElementById('video-screen-video')
  if (video) {
    video.style.display = 'block'
    video.style.position = 'fixed'
    video.style.top = '100px'
    video.style.width = '100%'
    video.style.height = '480px'
    video.style.zIndex = '9999'
    console.log('🔍 视频元素已显示')
  }
}

// ========== 渲染循环 ==========
// 设置 renderer 的 animation loop(进入 VR 后每帧更新)
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
            }
          }
        }
      })
    }
  })
}

// 更新相对旋转(在握把按下时计算相对于初始角度的变化)
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
  
  // 右手相对旋转(同左手)
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

// 在 WebXR frame 中更新数据面板(每帧绘制 Canvas)
function updateDataPanelInFrame(time, frame, referenceSpace, session) {
  if (!dataPanelContext || !dataPanelTexture) return
  if (!frame || !referenceSpace || !session) return
  
  const ctx = dataPanelContext
  const canvas = dataPanelTexture.image
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 背景(半透明黑色)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // 边框(青色)
  ctx.strokeStyle = '#00ffff'
  ctx.lineWidth = 8
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20)
  
  // 标题
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 70px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('◈ DATA CENTER ◈', canvas.width / 2, 90)
  
  // 获取完整的 VR 数据(从头显和手柄读取)
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
  
  // 更新纹理(通知 Three.js 重新渲染)
  dataPanelTexture.needsUpdate = true
}

// 显示单个手柄数据(位置/旋转/摇杆/按钮)
function displayControllerData(ctx, canvas, controller, hand, xPos) {
  const isLeft = hand === 'left'
  
  // 标题(LEFT/RIGHT)
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
  // 检测左手 menu 键 (button 12),按下后重启系统
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
  
  // 按钮信息(遍历所有按钮,根据值显示不同颜色)
  ctx.fillStyle = '#ffffff'
  ctx.font = '45px monospace'
  
  let yPos = 370
  for (let i = 0; i < controller.buttons.length && yPos < 1150; i++) {
    const btn = controller.buttons[i]
    const name = getButtonName(btn.index, hand)
    const value = btn.value.toFixed(2)
    const text = `${name}: ${value}`
    
    // 根据值设置颜色(>0.5 橙色, >0 黄色, =0 灰色)
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

// ========== 工具函数 ==========
// 简化的视频屏幕创建函数(将 video 元素转为 3D 网格)
function createVideoScreen(videoElement, width = 1.6, height = 0.9) {
  const texture = new THREE.VideoTexture(videoElement)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  )
  
  return { mesh, texture }
}

// 在 WebXR frame 中更新视频屏幕(每帧更新纹理)
function updateVideoScreenInFrame() {
  // 更新视频纹理
  if (videoScreenMesh && videoScreenMesh.material) {
    const texture = videoScreenMesh.material.map
    if (texture && texture.image) {
      texture.needsUpdate = true
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

:deep(.vr-scene-video) {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 50;
}

:deep(.vr-scene-video .video-container) {
  width: 100%;
  height: 100%;
  aspect-ratio: unset;
}
</style>
