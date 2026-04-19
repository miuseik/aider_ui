<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import VideoStreamManager from '../utils/videoStream'
import controllerManager from '../utils/controllerManager'

const sceneRef = ref(null)
let renderer = null
let scene = null
let camera = null
let xrSession = null
let screenMesh = null
let videoStream = null

const vrButtonClicked = ref(false)
const videoFrame = ref('')

onMounted(() => {
  // 先初始化Three.js，确保screenMesh存在
  initThreeJS()

  // 再初始化视频流
  videoStream = new VideoStreamManager(8443)
  videoStream.onFrameUpdate = (frame) => {
    videoFrame.value = frame
  }
  videoStream.connect()
})

onUnmounted(() => {
  if (videoStream) {
    videoStream.disconnect()
  }
  controllerManager.disconnect()
})

const handleEnterVR = async () => {
  if (!navigator.xr) {
    alert('您的设备不支持WebXR')
    return
  }

  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    })

    renderer.xr.setSession(session)
    renderer.xr.setReferenceSpaceType('local-floor')
    vrButtonClicked.value = true

    session.addEventListener('end', () => {
      xrSession = null
      vrButtonClicked.value = false
    })
  } catch (err) {
    alert('无法进入VR模式: ' + err.message)
  }
}

const initThreeJS = () => {
  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000011)

  // 创建相机
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.xr.enabled = true
  renderer.autoClear = true
  
  // 提高VR渲染分辨率
  renderer.xr.setFramebufferScaleFactor(6.0)
  
  // 禁用运动预测，减少残影
  renderer.xr.setFoveation(1)

  if (sceneRef.value) {
    sceneRef.value.appendChild(renderer.domElement)
  }
    
  // 添加光源
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(5, 5, 5)
  scene.add(directionalLight)

  // 创建太空舱控制面板
  const panelGroup = new THREE.Group()

  // 面板主体
  const panelGeometry = new THREE.BoxGeometry(5.0, 2.8, 0.1)  // 继续放大
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.3,
    metalness: 0.8
  })
  const panel = new THREE.Mesh(panelGeometry, panelMaterial)
  panelGroup.add(panel)

  // 屏幕区域
  const canvas = document.createElement('canvas')
  canvas.width = 7680
  canvas.height = 4320
  const context = canvas.getContext('2d')

  const screenTexture = new THREE.CanvasTexture(canvas)
  screenTexture.minFilter = THREE.LinearFilter
  screenTexture.magFilter = THREE.LinearFilter
  screenTexture.anisotropy = 0
  screenTexture.generateMipmaps = false
  const screenGeometry = new THREE.PlaneGeometry(4.99, 2.79)  // 匹配面板大小
  const screenMaterial = new THREE.MeshBasicMaterial({
    map: screenTexture,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 1
  })
  screenMesh = new THREE.Mesh(screenGeometry, screenMaterial)
  screenMesh.position.z = 0.06
  screenMesh.renderOrder = 999
  panelGroup.add(screenMesh)
  
  // 暴露给全局供videoStream使用
  window.__vrScene = { screenMesh }

  // 创建数据中心面板（固定在场景底部）
  const dataPanelCanvas = document.createElement('canvas')
  dataPanelCanvas.width = 3840
  dataPanelCanvas.height = 1200  // 高度减半，匹配几何体
  const dataPanelContext = dataPanelCanvas.getContext('2d')
  
  const dataPanelTexture = new THREE.CanvasTexture(dataPanelCanvas)
  dataPanelTexture.minFilter = THREE.LinearFilter
  dataPanelTexture.magFilter = THREE.LinearFilter
  
  const dataPanelGeometry = new THREE.PlaneGeometry(3.0, 0.95)  // 高度减半
  const dataPanelMaterial = new THREE.MeshBasicMaterial({
    map: dataPanelTexture,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })
  const dataPanelMesh = new THREE.Mesh(dataPanelGeometry, dataPanelMaterial)
  dataPanelMesh.position.set(0, -0.2, -1.5)  // 往上移
  dataPanelMesh.rotation.x = -Math.PI / 12  // 底部向前倾斜15度
  dataPanelMesh.renderOrder = 1000  // 确保在最上层
  scene.add(dataPanelMesh)

  // 更新屏幕显示
  function updateScreen(frame, referenceSpace) {
    if (!context || !screenTexture) return

    try {
      // 先清空Canvas
      context.clearRect(0, 0, 7680, 4320)
      
      // 绘制视频帧（如果有）
      if (videoStream) {
        const frameImage = videoStream.getLatestFrameImage()
        // 只有当 Image 已加载完成时才绘制
        if (frameImage && frameImage.complete && frameImage.naturalWidth > 0 && frameImage.naturalHeight > 0) {
          try {
            // 铺满整个屏幕
            context.drawImage(frameImage, 0, 0, 7680, 4320)
          } catch(e) {
            // 静默失败，避免控制台刷屏
          }
        }
      }

      screenTexture.needsUpdate = true
    } catch (e) {
      // 忽略错误
    }
  }

  // 设置面板位置（正前方）
  panelGroup.position.set(0, 1.5, -2)
  scene.add(panelGroup)

  // 添加VR控制器
  const controllerModelFactory = new XRControllerModelFactory()

  const controllerGrip1 = renderer.xr.getControllerGrip(0)
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
  scene.add(controllerGrip1)

  const controllerGrip2 = renderer.xr.getControllerGrip(1)
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2))
  scene.add(controllerGrip2)

  const controller1 = renderer.xr.getController(0)
  controller1.addEventListener('connected', (event) => {
    controller1.add(new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    ).rotateX(Math.PI / 2).translateZ(-0.05))
  })
  scene.add(controller1)

  const controller2 = renderer.xr.getController(1)
  controller2.addEventListener('connected', (event) => {
    controller2.add(new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    ).rotateX(Math.PI / 2).translateZ(-0.05))
  })
  scene.add(controller2)

  // 动画循环
  renderer.setAnimationLoop((timestamp, frame) => {
    const session = renderer.xr.getSession()
    const referenceSpace = renderer.xr.getReferenceSpace()
    updateScreen(frame, referenceSpace)
    
    // 更新数据中心面板
    if (dataPanelContext && dataPanelTexture && session && frame && referenceSpace) {
      try {
      // 清空画布
      dataPanelContext.clearRect(0, 0, 3840, 1200)
      
      // 背景
      dataPanelContext.fillStyle = 'rgba(0, 0, 0, 0.85)'
      dataPanelContext.fillRect(0, 0, 3840, 1200)
      
      // 边框
      dataPanelContext.strokeStyle = '#00ffff'
      dataPanelContext.lineWidth = 8
      dataPanelContext.strokeRect(10, 10, 3820, 1180)
      
      // 标题
      dataPanelContext.fillStyle = '#00ffff'
      dataPanelContext.font = 'bold 70px monospace'
      dataPanelContext.textAlign = 'center'
      dataPanelContext.fillText('◈ DATA CENTER ◈', 1920, 90)
      
      // 获取头显数据
      let headsetPos = '0.00, 0.00, 0.00'
      let headsetRot = '0.00, 0.00, 0.00'
      try {
        const viewerPose = frame.getViewerPose(referenceSpace)
        if (viewerPose) {
          const pos = viewerPose.transform.position
          const quat = viewerPose.transform.orientation
          headsetPos = pos.x.toFixed(2) + ', ' + pos.y.toFixed(2) + ', ' + pos.z.toFixed(2)
          headsetRot = quat.x.toFixed(2) + ', ' + quat.y.toFixed(2) + ', ' + quat.z.toFixed(2)
        }
      } catch(e) {}
      
      // 头显信息 - 顶部
      dataPanelContext.textAlign = 'center'
      dataPanelContext.fillStyle = '#00ff88'
      dataPanelContext.font = 'bold 55px monospace'
      dataPanelContext.fillText('HEADSET', 1920, 170)
      
      dataPanelContext.fillStyle = '#ffffff'
      dataPanelContext.font = '45px monospace'
      dataPanelContext.fillText('POS: ' + headsetPos, 1920, 230)
      dataPanelContext.fillText('ROT: ' + headsetRot, 1920, 280)
      
      // 获取手柄数据并显示
      const sources = session.inputSources
      if (sources) {
        // 左手柄 - 左侧
        for (let s = 0; s < sources.length; s++) {
          const source = sources[s]
          if (source.handedness !== 'left' || !source.gamepad) continue
          
          const gp = source.gamepad
          
          // 标题
          dataPanelContext.textAlign = 'left'
          dataPanelContext.fillStyle = '#00ff88'
          dataPanelContext.font = 'bold 65px monospace'
          dataPanelContext.shadowBlur = 30
          dataPanelContext.shadowColor = '#00ff88'
          dataPanelContext.fillText('◈ LEFT ◈', 100, 420)
          dataPanelContext.shadowBlur = 0
          
          // 显示位置
          let posText = 'POS: 0.00, 0.00, 0.00'
          let rotText = 'ROT: 0.00, 0.00, 0.00'
          try {
            if (frame && referenceSpace && source.gripSpace) {
              const pose = frame.getPose(source.gripSpace, referenceSpace)
              if (pose) {
                const pos = pose.transform.position
                const quat = pose.transform.orientation
                posText = 'POS: ' + pos.x.toFixed(2) + ', ' + pos.y.toFixed(2) + ', ' + pos.z.toFixed(2)
                rotText = 'ROT: ' + quat.x.toFixed(2) + ', ' + quat.y.toFixed(2) + ', ' + quat.z.toFixed(2)
              }
            }
          } catch(e) {}
          
          dataPanelContext.fillStyle = '#00ffcc'
          dataPanelContext.font = '42px monospace'
          dataPanelContext.fillText(posText, 100, 500)
          dataPanelContext.fillText(rotText, 100, 560)
          
          // 摇杆数据
          dataPanelContext.fillStyle = '#00ffff'
          dataPanelContext.font = 'bold 48px monospace'
          dataPanelContext.shadowBlur = 20
          dataPanelContext.shadowColor = '#00ffff'
          const joyX = (gp.axes && gp.axes.length > 2 && gp.axes[2] !== undefined ? gp.axes[2] : 0).toFixed(2)
          const joyY = (gp.axes && gp.axes.length > 3 && gp.axes[3] !== undefined ? gp.axes[3] : 0).toFixed(2)
          dataPanelContext.fillText('JOY: ' + joyX + ', ' + joyY + ' (len:' + (gp.axes ? gp.axes.length : 0) + ')', 100, 640)
          dataPanelContext.shadowBlur = 0
          
          // 按钮信息
          dataPanelContext.fillStyle = '#ffffff'
          dataPanelContext.font = '45px monospace'
          
          let yPos = 720
          for (let i = 0; i < gp.buttons.length && yPos < 1150; i++) {
            const btn = gp.buttons[i]
            if (!btn) continue
            
            let name = '[' + i + ']'
            if (i === 0) name = '扳机'
            else if (i === 1) name = '握把'
            else if (i === 2) name = '未知'
            else if (i === 3) name = '摇杆'
            else if (i === 4) name = 'X键'
            else if (i === 5) name = 'Y键'
            else if (i === 7) name = '食指接近'
            else if (i === 9) name = '扳机触摸'
            else if (i === 10) name = '拇指触摸'
            else if (i === 12) name = 'Menu'
            
            const value = (btn.value !== undefined ? btn.value : 0).toFixed(2)
            const text = name + ': ' + value
            
            // 根据值设置颜色
            if (btn.value > 0.5) {
              dataPanelContext.fillStyle = '#ff6600'
              dataPanelContext.shadowBlur = 20
              dataPanelContext.shadowColor = '#ff6600'
            } else if (btn.value > 0) {
              dataPanelContext.fillStyle = '#ffaa00'
              dataPanelContext.shadowBlur = 10
              dataPanelContext.shadowColor = '#ffaa00'
            } else {
              dataPanelContext.fillStyle = '#666666'
              dataPanelContext.shadowBlur = 0
            }
            
            dataPanelContext.fillText(text, 100, yPos)
            yPos += 55
          }
          dataPanelContext.shadowBlur = 0
          break
        }
        
        // 右手柄 - 右侧
        for (let s = 0; s < sources.length; s++) {
          const source = sources[s]
          if (source.handedness !== 'right' || !source.gamepad) continue
          
          const gp = source.gamepad
          
          // 标题
          dataPanelContext.textAlign = 'right'
          dataPanelContext.fillStyle = '#ff6688'
          dataPanelContext.font = 'bold 65px monospace'
          dataPanelContext.shadowBlur = 30
          dataPanelContext.shadowColor = '#ff6688'
          dataPanelContext.fillText('◈ RIGHT ◈', 3740, 420)
          dataPanelContext.shadowBlur = 0
          
          // 显示位置
          let posText = 'POS: 0.00, 0.00, 0.00'
          let rotText = 'ROT: 0.00, 0.00, 0.00'
          try {
            if (frame && referenceSpace && source.gripSpace) {
              const pose = frame.getPose(source.gripSpace, referenceSpace)
              if (pose) {
                const pos = pose.transform.position
                const quat = pose.transform.orientation
                posText = 'POS: ' + pos.x.toFixed(2) + ', ' + pos.y.toFixed(2) + ', ' + pos.z.toFixed(2)
                rotText = 'ROT: ' + quat.x.toFixed(2) + ', ' + quat.y.toFixed(2) + ', ' + quat.z.toFixed(2)
              }
            }
          } catch(e) {}
          
          dataPanelContext.fillStyle = '#ff99aa'
          dataPanelContext.font = '42px monospace'
          dataPanelContext.fillText(posText, 3740, 500)
          dataPanelContext.fillText(rotText, 3740, 560)
          
          // 摇杆数据
          dataPanelContext.fillStyle = '#00ffff'
          dataPanelContext.font = 'bold 48px monospace'
          dataPanelContext.shadowBlur = 20
          dataPanelContext.shadowColor = '#00ffff'
          const joyX = (gp.axes && gp.axes.length > 2 && gp.axes[2] !== undefined ? gp.axes[2] : 0).toFixed(2)
          const joyY = (gp.axes && gp.axes.length > 3 && gp.axes[3] !== undefined ? gp.axes[3] : 0).toFixed(2)
          dataPanelContext.fillText('JOY: ' + joyX + ', ' + joyY + ' (len:' + (gp.axes ? gp.axes.length : 0) + ')', 3740, 640)
          dataPanelContext.shadowBlur = 0
          
          // 按钮信息
          dataPanelContext.fillStyle = '#ffffff'
          dataPanelContext.font = '45px monospace'
          
          let yPos = 720
          for (let i = 0; i < gp.buttons.length && yPos < 1150; i++) {
            const btn = gp.buttons[i]
            if (!btn) continue
            
            let name = '[' + i + ']'
            if (i === 0) name = '扳机'
            else if (i === 1) name = '握把'
            else if (i === 2) name = '未知'
            else if (i === 3) name = '摇杆'
            else if (i === 4) name = 'A键'
            else if (i === 5) name = 'B键'
            else if (i === 7) name = '食指接近'
            else if (i === 9) name = '扳机触摸'
            else if (i === 10) name = '拇指触摸'
            
            const value = (btn.value !== undefined ? btn.value : 0).toFixed(2)
            const text = name + ': ' + value
            
            // 根据值设置颜色
            if (btn.value > 0.5) {
              dataPanelContext.fillStyle = '#ff6600'
              dataPanelContext.shadowBlur = 20
              dataPanelContext.shadowColor = '#ff6600'
            } else if (btn.value > 0) {
              dataPanelContext.fillStyle = '#ffaa00'
              dataPanelContext.shadowBlur = 10
              dataPanelContext.shadowColor = '#ffaa00'
            } else {
              dataPanelContext.fillStyle = '#666666'
              dataPanelContext.shadowBlur = 0
            }
            
            dataPanelContext.fillText(text, 3740, yPos)
            yPos += 55
          }
          dataPanelContext.shadowBlur = 0
          dataPanelContext.textAlign = 'left'
          break
        }
      }
      
      dataPanelTexture.needsUpdate = true
      } catch(e) {
        // 静默失败，避免卡死
      }
    }
      
    // 让屏幕跟随头显位置和旋转
    if (frame && referenceSpace && panelGroup) {
      const xrCamera = renderer.xr.getCamera(camera)
      
      // 固定在眼前2米处，永远正对眼睛
      panelGroup.position.copy(xrCamera.position)
      panelGroup.quaternion.copy(xrCamera.quaternion)
      panelGroup.translateZ(-2)
    }
    
    // 发送手柄数据
    if (controllerManager && session && frame && referenceSpace) {
      const sources = session.inputSources
      if (sources) {
        for (let i = 0; i < sources.length; i++) {
          const source = sources[i]
          if (!source.gamepad || !source.gripSpace) continue
          
          const pose = frame.getPose(source.gripSpace, referenceSpace)
          if (!pose) continue
          
          const pos = pose.transform.position
          const quat = pose.transform.orientation
          
          // 计算欧拉角
          const euler = new THREE.Euler().setFromQuaternion(
            new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w),
            'YXZ'
          )
          
          const gp = source.gamepad
          
          // Grip 按钮（索引1）
          const gripActive = gp.buttons[1] ? gp.buttons[1].pressed : false
          
          // Trigger 按钮（索引0）- 力度值
          const triggerValue = gp.buttons[0] ? gp.buttons[0].value : 0
          
          // 摇杆（axes[2]=X, axes[3]=Y）
          const thumbstick = {
            x: gp.axes[2] || 0,
            y: gp.axes[3] || 0
          }
          
          // 根据左右手分别发送不同的控制命令
          if (source.handedness === 'left') {
            // 左手：摇杆控制底盘前进/转向
            controllerManager.sendLeftControllerData(
              { x: pos.x, y: pos.y, z: pos.z },
              { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) },
              thumbstick,
              triggerValue,
              gripActive
            )
          } else if (source.handedness === 'right') {
            // 右手：摇杆控制升降/平移，扳机控制爪机
            controllerManager.sendRightControllerData(
              { x: pos.x, y: pos.y, z: pos.z },
              { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) },
              thumbstick,
              triggerValue,
              gripActive
            )
          }
        }
      }
    }
      
    const xrCamera = renderer.xr.getCamera(camera)
    renderer.clear()
    renderer.render(scene, xrCamera)
    
    // 渲染后强制更新纹理
    if (screenTexture) {
      screenTexture.needsUpdate = true
    }
  })

  // 窗口大小调整
  window.addEventListener('resize', onWindowResize)
}

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

onUnmounted(() => {
  renderer.setAnimationLoop(null)
  if (xrSession) {
    xrSession.end()
  }
  if (renderer) {
    renderer.dispose()
  }
  window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <div class="vr-scene" ref="sceneRef">
    <!-- 非VR模式下的视频显示 -->
    <div class="video-overlay">
      <img :src="`data:image/jpeg;base64,${videoFrame}`" class="video-frame" />
    </div>
    
    <div v-if="!vrButtonClicked" class="vr-enter-overlay">
      <button @click="handleEnterVR" class="vr-enter-btn">进入 VR 沉浸模式</button>
    </div>
  </div>
</template>

<style scoped>
.vr-scene {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
  z-index: 10;
}

.vr-enter-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
}

.vr-enter-btn {
  padding: 20px 60px;
  font-size: 24px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.vr-enter-btn:hover {
  background: #359c6d;
  transform: scale(1.05);
}

.video-overlay {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 640px;
  height: 480px;
  z-index: 100;
  border: 2px solid #00ffff;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.video-frame {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
