/**
 * BVH 动作 → 演员模型的骨骼重定向。
 *
 * 这是一个纯 three.js 模块（不依赖 Vue），所有函数都可以脱离组件单独跑，
 * 便于用 node 直接断言"第一帧等于绑定姿势""匹配到的骨骼数不为 0"这类性质。
 */
import * as THREE from 'three'

/** 骨骼名归一化：小写 + 只留字母数字，用于跨命名规范匹配 */
export function normBone(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * BVH(iClone/TrueBones 风格) → Mixamo/Xbot 骨骼语义映射
 * key/value 都用 normBone 归一化后的名字（小写、去非字母数字、去 mixamorig 前缀）
 */
export const BONE_MAP_MIXAMO = {
  hip: 'hips',
  abdomen: 'spine1',
  chest: 'spine2',
  neck: 'neck',
  head: 'head',
  lcollar: 'leftshoulder',
  lshldr: 'leftarm',
  lforearm: 'leftforearm',
  lhand: 'lefthand',
  rcollar: 'rightshoulder',
  rshldr: 'rightarm',
  rforearm: 'rightforearm',
  rhand: 'righthand',
  lthigh: 'leftupleg',
  lshin: 'leftleg',
  lfoot: 'leftfoot',
  rthigh: 'rightupleg',
  rshin: 'rightleg',
  rfoot: 'rightfoot'
}

/**
 * April（DAZ Genesis）骨骼映射：hip / pelvis / abdomenLower·Upper / chestLower·Upper /
 * neckLower·Upper / lShldrBend·Twist / lForearmBend·Twist / lThighBend·Twist / lShin / lFoot
 * 脊柱只取相邻两段（abdomenUpper + chestLower），Twist/Bend 副骨骼不驱动。
 */
export const BONE_MAP_DAZ = {
  hip: 'hip',
  abdomen: 'abdomenupper',
  chest: 'chestlower',
  neck: 'necklower',
  head: 'head',
  lcollar: 'lcollar',
  lshldr: 'lshldrbend',
  lforearm: 'lforearmbend',
  lhand: 'lhand',
  rcollar: 'rcollar',
  rshldr: 'rshldrbend',
  rforearm: 'rforearmbend',
  rhand: 'rhand',
  lthigh: 'lthighbend',
  lshin: 'lshin',
  lfoot: 'lfoot',
  rthigh: 'rthighbend',
  rshin: 'rshin',
  rfoot: 'rfoot'
}

/**
 * 统一尺寸基准 —— Aider 机器人自身高度。
 * 实测：URDF 全部 mesh 加载完后渲染包围盒 size=(0.495, 1.760, 0.604) → **站高 1.76m**
 * （只做关节 FK 会得到 0.78m，那是关节原点范围，没算 STL 网格自身的体积，别用那个值。）
 * 所有演员（火柴人 / Xbot / April）都按骨骼高度归一到这个尺寸，跟真机同比例。
 */
export const ACTOR_HEIGHT = 1.76

/**
 * 火柴人（骨架示意）的额外放大倍数。
 * 它只是线框，跟 Aider 同高时看起来又小又密，所以单独放大（相机是自适应取景的，
 * 所以这里放大后屏幕占比不变，变的是它相对地面网格的比例）。
 */
export const SKELETON_ZOOM = 100

/**
 * 骨骼索引：归一化名 → 骨骼数组。
 * 用数组是因为 April 这类从 DAZ/Blender 导出的 FBX 里，身体/衣服/头发各自带一份
 * 同名骨架（实测 1630 根骨骼 = 8 份副本），只驱动一份会让其它部件不动。
 * 模型侧再去掉 mixamorig 前缀。
 */
export function indexBones(root, isModel) {
  const map = {}
  root.traverse((o) => {
    if (!o.isBone) return
    let key = normBone(o.name)
    if (isModel) key = key.replace(/^mixamorig/, '')
    if (!map[key]) map[key] = []
    map[key].push(o)
  })
  return map
}

/** 骨架（纯 Bone）没有几何体，Box3.setFromObject 会得到空盒并算出 NaN 相机，这里用骨骼点算 */
export function boneBox(root) {
  root.updateWorldMatrix(true, true)
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  let n = 0
  root.traverse((o) => {
    if (o.isBone) { box.expandByPoint(o.getWorldPosition(v)); n++ }
  })
  return n ? box : null
}

/**
 * 把 BVH 动作重定向到演员模型。命名体系、rest 姿势(T-pose/A-pose)、单位(英寸/厘米)、
 * 甚至骨骼父链朝向（April 的 hip 在带旋转的根节点下）都不一样，所以要做四件事：
 *   旋转 = 目标 rest × 源 rest⁻¹ × 源旋转   —— 第一帧正好落回绑定姿势，抵消 rest 与局部轴差异
 *   髋部位置 = 目标绑定位置 + (源位移 × 髋高比例)，并把位移从世界轴转到目标父节点局部轴
 *   同名多份骨架（衣服/头发）全部写 track，否则只有一部分部件跟着动
 * track 名用骨骼 uuid，避免 'mixamorig:Hips' 这类带冒号的名字被解析成节点路径。
 */
export function retargetClipToModel(clip, sourceRoot, model, boneMap) {
  sourceRoot.updateWorldMatrix(true, true)
  model.updateMatrixWorld(true)
  const srcIdx = indexBones(sourceRoot, false)
  const tgtIdx = indexBones(model, true)

  const tgtHip = tgtIdx[boneMap.hip] ? tgtIdx[boneMap.hip][0] : null

  // 位移换算系数：源单位 → 目标骨骼局部单位 = 骨架高度比 ÷ 父链缩放。
  // 不用髋骨第一帧位置算，因为这套 BVH 的 hip 第一帧就在原点(y=0)。
  let k = 0
  const srcBox = boneBox(sourceRoot)
  const tgtBox = boneBox(model)
  if (srcBox && tgtBox && tgtHip) {
    const srcH = srcBox.getSize(new THREE.Vector3()).y
    const tgtH = tgtBox.getSize(new THREE.Vector3()).y
    const ps = tgtHip.parent ? tgtHip.parent.getWorldScale(new THREE.Vector3()).x || 1 : 1
    if (srcH > 1e-6) k = tgtH / srcH / ps
  }

  const tracks = []
  const matched = new Set()
  const v = new THREE.Vector3()
  const q = new THREE.Quaternion()

  for (const track of clip.tracks) {
    const dot = track.name.indexOf('.')
    if (dot < 0) continue
    const prop = track.name.slice(dot)
    const srcKey = normBone(track.name.slice(0, dot))
    const tgtKey = boneMap[srcKey]
    const srcBone = srcIdx[srcKey] ? srcIdx[srcKey][0] : null
    const tgtBones = tgtKey ? tgtIdx[tgtKey] : null
    if (!srcBone || !tgtBones || !tgtBones.length) continue

    if (prop === '.quaternion') {
      const src = track.values
      // 源 rest 取 clip 的第一帧：BVHLoader 解析完骨骼还是隐藏的初始朝向（不是第一帧姿态），
      // 拿骨骼当前旋转当 rest 会让整套动作整体多转一个角度（人直接躺下）
      const srcRestInv = new THREE.Quaternion(src[0], src[1], src[2], src[3]).invert()
      for (const tgtBone of tgtBones) {
        const offset = tgtBone.quaternion.clone().multiply(srcRestInv)
        const out = new Float32Array(src.length)
        for (let i = 0; i < src.length; i += 4) {
          q.set(src[i], src[i + 1], src[i + 2], src[i + 3]).premultiply(offset)
          out[i] = q.x
          out[i + 1] = q.y
          out[i + 2] = q.z
          out[i + 3] = q.w
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(`${tgtBone.uuid}${prop}`, track.times, out))
      }
      matched.add(srcKey)
    } else if (prop === '.position' && srcKey === 'hip' && k) {
      const src = track.values
      const x0 = src[0]
      const y0 = src[1]
      const z0 = src[2]
      for (const tgtBone of tgtBones) {
        const rest = tgtBone.position.clone()
        const invParent = new THREE.Quaternion()
        if (tgtBone.parent) tgtBone.parent.getWorldQuaternion(invParent).invert()
        const out = new Float32Array(src.length)
        for (let i = 0; i < src.length; i += 3) {
          v.set(src[i] - x0, src[i + 1] - y0, src[i + 2] - z0)
            .multiplyScalar(k)
            .applyQuaternion(invParent)
          out[i] = rest.x + v.x
          out[i + 1] = rest.y + v.y
          out[i + 2] = rest.z + v.z
        }
        tracks.push(new THREE.VectorKeyframeTrack(`${tgtBone.uuid}${prop}`, track.times, out))
      }
    }
  }

  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

/**
 * 演员尺寸归一：缩放到 Aider 的高度。
 *
 * ⚠️ 只缩放"骨架根骨骼"，绝不能缩放模型根节点：
 * 蒙皮顶点 = meshWorld × bindMatrixInverse × boneWorld × boneInverse × bindMatrix × v，
 * mesh 和骨骼都在模型根下时，两者的世界矩阵各带一次模型根缩放 → 整体缩放变成 s²，
 * 顶点全被拉乱（April 直接变成一团怪形状）。只缩骨骼根则只有 boneWorld 带缩放，正好一次。
 * （Xbot 正常是因为它的 0.01 缩放本来就写在骨架 Armature 上。）
 */
export function scaleActorToHuman(model, target = ACTOR_HEIGHT) {
  model.updateMatrixWorld(true)
  const box = boneBox(model)
  if (!box) return
  const h = box.getSize(new THREE.Vector3()).y
  if (h <= 1e-6) return
  const k = target / h
  let n = 0
  model.traverse((o) => {
    if (o.isBone && (!o.parent || !o.parent.isBone)) {
      o.scale.multiplyScalar(k)
      n++
    }
  })
  if (n) model.updateMatrixWorld(true)
}

/**
 * 等 LoadingManager 把队列里的资源全部加载完。
 * urdf-loader 的 loadAsync 只等 URDF 文件本身解析完就返回，mesh 还在后台下载，
 * 此时立刻取景/算包围盒都是在算一个空模型（相机会乱、模型可能看不到）。
 */
export function whenManagerIdle(manager, timeout = 180000) {
  return new Promise((resolve) => {
    if (manager.itemsTotal > 0 && manager.itemsLoaded >= manager.itemsTotal) return resolve()
    const prev = manager.onLoad
    manager.onLoad = () => {
      if (prev) prev()
      resolve()
    }
    setTimeout(resolve, timeout)
  })
}
