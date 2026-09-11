/**
 * 动作预览的 three.js 场景。
 *
 * 负责：渲染器/相机/控制器生命周期、把动作装进场景（骨架或重定向到演员模型/机器人关节）、
 * 播放控制与进度同步。动作"从哪来"（列表/筛选/AIist）不归这里管。
 */
import { ref, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { motionFileUrl, fetchAiderJointLimits, solveMotionIK } from '../api/motion'
import { ACTORS, loadActorModel } from '../three/actors'
import {
  ACTOR_HEIGHT,
  SKELETON_ZOOM,
  boneBox,
  retargetClipToModel,
  scaleActorToHuman
} from '../three/motionRetarget'
import { findUrdfRobot, makeArmDriver, relaxJointLimits, extractArmClip, ARM_JOINT_COUNT } from '../three/aiderJoints'
import { createJointPlayer } from '../three/jointPlayer'

/**
 * @param {object} opts
 * @param {import('vue').Ref<HTMLElement|null>} opts.canvasRef 画布容器
 * @param {import('vue').Ref<string>} opts.error 与页面共享的错误文案 ref
 */
export function useMotionScene({ canvasRef, error }) {
  const current = ref(null)          // 当前预览的文件（列表行）
  const playing = ref(false)
  const currentTime = ref(0)
  const progress = ref(0)
  const speed = ref(1)
  const busyTip = ref('')
  const aiderJoints = ref(0)         // Aider 模式下跟随动作的关节数

  let renderer, scene, camera, controls, mixer, clock, animId
  let currentObject = null
  let action = null
  let ghostGroup = null    // Aider 模式下的隐形"动作源"骨架（不可见，只提供骨骼旋转）
  let armDriver = null     // 前端方向对齐 IK 驱动器（降级模式：Python IK 不可用时）
  let jointPlayer = null   // Python IK 序列播放器（首选：数据即真机指令）

  function initThree() {
    if (renderer) return
    const wrap = canvasRef.value
    if (!wrap) return
    const width = wrap.clientWidth || 800
    const height = wrap.clientHeight || 600

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1f)
    // far 给宽一点：万一某天来了个尺度没归一化的模型，也不至于被远裁剪成一片空白
    camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 1000)
    camera.position.set(0, 0.8, 1.8)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    wrap.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.4, 0)
    controls.enableDamping = true
    controls.update()

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0))
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(2, 4, 3)
    scene.add(dir)
    // 网格按 Aider 尺度来（模型只有 0.78m，10m 的网格会显得空荡荡）
    scene.add(new THREE.GridHelper(4, 8, 0x444444, 0x2a2a2a))

    clock = new THREE.Clock()
    window.addEventListener('resize', onResize)
    animate()
  }

  function onResize() {
    if (!renderer || !canvasRef.value) return
    const w = canvasRef.value.clientWidth
    const h = canvasRef.value.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  function animate() {
    animId = requestAnimationFrame(animate)
    const dt = clock.getDelta()
    if (mixer) mixer.update(dt)
    if (jointPlayer) jointPlayer.update(dt * speed.value)
    if (armDriver) {
      ghostGroup?.updateMatrixWorld(true)
      armDriver.update()
    }
    controls?.update()
    if (current.value?.duration) {
      const t = action ? action.time : jointPlayer ? jointPlayer.time : 0
      currentTime.value = t
      progress.value = Math.min(1000, (t / current.value.duration) * 1000)
    }
    renderer?.render(scene, camera)
  }

  /** 清掉当前预览（不动 current 这个 ref，由调用方决定要不要置空） */
  function disposeScene() {
    if (currentObject) {
      scene?.remove(currentObject)
      if (!currentObject.userData?.keepInCache) {
        currentObject.traverse?.((o) => {
          if (o.geometry) o.geometry.dispose?.()
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            mats.forEach((m) => m.dispose?.())
          }
        })
      }
      currentObject = null
    }
    if (ghostGroup) {
      scene?.remove(ghostGroup)
      ghostGroup = null
    }
    armDriver = null
    if (jointPlayer) {
      jointPlayer.dispose()
      jointPlayer = null
    }
    aiderJoints.value = 0
    mixer?.stopAllAction()
    mixer = null
    action = null
    playing.value = false
    currentTime.value = 0
    progress.value = 0
  }

  function fitCamera(obj, hint, boxOverride) {
    const box = boxOverride || new THREE.Box3().setFromObject(obj)
    if (!box || box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || hint || 2
    controls.target.copy(center)
    camera.position.set(center.x + maxDim * 1.2, center.y + maxDim * 0.4, center.z + maxDim * 1.8)
    controls.update()
  }

  /**
   * 预览一个动作文件。
   * @param {object} file 列表行（含 src / ext / url / path / raw）
   * @param {string} actorKey 'skeleton' | ACTORS 的 key
   */
  async function loadMotion(file, actorKey) {
    error.value = ''
    current.value = file
    await nextTick()
    initThree()
    disposeScene()

    try {
      if (!file.previewable) {
        error.value = `暂不支持预览 .${file.ext}（可先用 Blender 转成 BVH/FBX）`
        return
      }

      let text = null
      let buffer = null
      if (file.src === 'picker') {
        if (file.ext === 'bvh') text = await file.raw.text()
        else buffer = await file.raw.arrayBuffer()
      } else {
        const url = file.url || motionFileUrl(file.path)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`)
        if (file.ext === 'bvh') text = await res.text()
        else buffer = await res.arrayBuffer()
      }

      if (file.ext === 'bvh') {
        const result = new BVHLoader().parse(text)

        if (actorKey !== 'skeleton') {
          // ⚠️ 变量名别叫 actor：会和组件的 actor ref 撞名，整段落进 TDZ 直接报
          // "Cannot access 'actor' before initialization"
          const actorCfg = ACTORS[actorKey]
          busyTip.value = '正在加载演员模型…（首次较慢）'
          try {
            const model = await loadActorModel(actorKey, (msg) => { busyTip.value = msg })
            if (model) {
              if (actorCfg.urdf) {
                // 机器人本体：优先消费 Python 侧 IK 解算的关节角序列（真机同款解算，
                // 预览=真机指令，单一数据源）；仅本机路径不可用/解算失败时回退前端映射
                currentObject = model
                scene.add(model)
                fitCamera(model, ACTOR_HEIGHT)
                const robot = findUrdfRobot(model)
                if (robot) {
                  // 限位优先取 server 的 servo_ids.yaml（唯一真源），后端不在时用内置兜底表
                  relaxJointLimits(robot, (await fetchAiderJointLimits()) || undefined)

                  let seq = null
                  if (file.src === 'dir' && file.path) {
                    busyTip.value = 'Python IK 解算中…（首次约 10-60s，结果有缓存）'
                    try {
                      seq = await solveMotionIK(file.path)
                    } finally {
                      busyTip.value = ''
                    }
                  }

                  if (seq && seq.angles && seq.angles.length) {
                    // 关节序列模式：BVH 已在 Python 端消化，不需要源骨架/前端映射
                    jointPlayer = createJointPlayer({
                      model,
                      names: seq.names,
                      angles: seq.angles,
                      frameTime: seq.frame_time,
                    })
                    file.duration = seq.n_frames * seq.frame_time
                    file.frames = seq.n_frames
                    aiderJoints.value = seq.names.length
                  } else {
                    if (file.src === 'dir' && file.path) {
                      error.value = 'IK 解算不可用，回退为前端映射预览（结果非真机指令）'
                    }
                    // 源骨架放进一个不可见容器当"动作源"（自己播 clip），
                    // 每帧读它的骨骼世界旋转 → 方向对齐迭代驱动 Aider 关节
                    const srcRoot = result.skeleton.bones[0]
                    ghostGroup = new THREE.Group()
                    ghostGroup.visible = false
                    ghostGroup.add(srcRoot)
                    scene.add(ghostGroup)
                    mixer = new THREE.AnimationMixer(srcRoot)
                    action = mixer.clipAction(result.clip)
                    // 先把源骨架摆到 clip 第一帧，再建驱动器：
                    // BVHLoader 解析出的绑定姿势不是第一帧姿态（多为 T-pose，而动作第一帧往往
                    // 手臂下垂），以绑定姿势当 rest 会把"T-pose→第一帧"的差值也当动作，
                    // 手臂会全程架在半空。与 retargetClipToModel 里取第一帧当源 rest 同理。
                    action.play()
                    mixer.update(0)
                    // ⚠️ 采样"机器人零位几何"前必须先刷新整个场景的世界矩阵：
                    // 刚 scene.add 的模型其外层装配旋转（URDF Z-up → three Y-up 的 -90°X）
                    // 还没传播到 matrixWorld，此时算出的零位方向缺这一层，会差约 90°，
                    // 后续 IK 会追一个错误的目标（手臂顶死在限位上）。
                    scene.updateMatrixWorld(true)
                    armDriver = makeArmDriver(srcRoot, robot)
                    aiderJoints.value = armDriver.joints
                  }
                } else {
                  error.value = '这个 URDF 里没有 joints 表，无法驱动关节'
                }
              } else {
                scaleActorToHuman(model)
                const retargeted = retargetClipToModel(
                  result.clip,
                  result.skeleton.bones[0],
                  model,
                  actorCfg.map
                )
                if (retargeted.tracks.length) {
                  currentObject = model
                  scene.add(model)
                  mixer = new THREE.AnimationMixer(model)
                  action = mixer.clipAction(retargeted)
                  // 取景必须用骨骼包围盒：蒙皮网格的几何体包围盒还是模型原始尺寸（DAZ 约 190 单位），
                  // 用它取景相机会被放到 far 之外，整屏空白
                  fitCamera(model, ACTOR_HEIGHT, boneBox(model))
                } else {
                  error.value = `BVH 骨骼与模型对不上（源 ${result.skeleton.bones.length} 根骨骼），已回退为骨架显示`
                }
              }
            }
          } finally {
            busyTip.value = ''
          }
        }

        if (!currentObject) {
          // 骨架模式（或模型加载失败）：显示火柴人
          const root = result.skeleton.bones[0]
          currentObject = new THREE.Group()
          currentObject.add(root)
          const helper = new THREE.SkeletonHelper(root)
          // SkeletonHelper 每帧只改顶点、不重算 boundingSphere：缩放后包围球还是旧的，
          // 整个骨架会被视锥剔除（屏幕上什么都没有），必须关掉剔除
          helper.frustumCulled = false
          currentObject.add(helper)
          scene.add(currentObject)
          mixer = new THREE.AnimationMixer(root)
          // 火柴人"只动胳膊"：只保留肩/肘/腕 track，身体站桩在绑定姿势 ——
          // 与机器人本体吃同一批源骨骼的旋转，两边胳膊动作才可比。
          // BVH 骨骼命名对不上映射表时回退完整 clip（保底能看）。
          const armClip = extractArmClip(result.clip)
          action = mixer.clipAction(armClip || result.clip)
          aiderJoints.value = ARM_JOINT_COUNT
          // BVH 单位是英寸（全身约 70 单位），按骨骼高度归一化到 1.75 米，
          // 与模型演员同一基准，切换演员时不会一会儿大一会儿小
          const raw = boneBox(root)
          const h = raw ? raw.getSize(new THREE.Vector3()).y : 0
          const target = ACTOR_HEIGHT * SKELETON_ZOOM
          // ⚠️ 缩放要加在"骨骼根"上，不能加在外层 Group：
          // SkeletonHelper 每帧把自己的顶点写成骨骼的【世界坐标】，若它所在的父节点也有缩放，
          // 渲染时会再乘一次 → 骨架被压成 1/40 大小（屏幕上几乎看不见）
          if (Number.isFinite(h) && h > 1e-6) root.scale.multiplyScalar(target / h)
          fitCamera(currentObject, target, boneBox(root))
        }

        if (!file.duration) file.duration = result.clip.duration
        if (!file.frames) file.frames = Math.round(result.clip.duration * 30)
      } else if (file.ext === 'fbx') {
        const obj = new FBXLoader().parse(buffer, '')
        currentObject = obj
        scene.add(obj)
        if (obj.animations?.length) {
          mixer = new THREE.AnimationMixer(obj)
          action = mixer.clipAction(obj.animations[0])
          if (!file.duration) file.duration = obj.animations[0].duration
        }
        fitCamera(obj, 2.0)
      }

      if (action) {
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.play()
        mixer.timeScale = speed.value
        playing.value = true
      } else if (jointPlayer) {
        jointPlayer.play()
        playing.value = true
      }
    } catch (err) {
      error.value = `加载失败：${err?.message || err}`
    }
  }

  function togglePlay() {
    if (!action && !jointPlayer) return
    playing.value = !playing.value
    if (action) action.paused = !playing.value
    if (jointPlayer) playing.value ? jointPlayer.play() : jointPlayer.pause()
  }

  function restart() {
    if (!action && !jointPlayer) return
    if (action) {
      action.reset()
      action.paused = false
    }
    if (jointPlayer) jointPlayer.seek(0)
    playing.value = true
    // 动作回第一帧，机器人关节也归回 rest 姿势，IK 从基准重新起步
    armDriver?.reset?.()
  }

  function seek(val) {
    const t = (val / 1000) * (current.value?.duration || 0)
    if (jointPlayer) {
      jointPlayer.seek(t)
      return
    }
    if (!action || !current.value?.duration) return
    action.time = t
    mixer?.update(0)
  }

  function setSpeed(v) {
    if (mixer) mixer.timeScale = v
  }

  /** 组件卸载时的整体清理 */
  function disposeAll() {
    if (animId) cancelAnimationFrame(animId)
    animId = null
    window.removeEventListener('resize', onResize)
    disposeScene()
    renderer?.dispose?.()
    renderer = null
  }

  return {
    // 状态
    current,
    playing,
    currentTime,
    progress,
    speed,
    busyTip,
    aiderJoints,
    // 动作
    initThree,
    loadMotion,
    disposeScene,
    disposeAll,
    togglePlay,
    restart,
    seek,
    setSpeed,
    onResize
  }
}
