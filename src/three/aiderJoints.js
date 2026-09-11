/**
 * 把人体动作投影到 Aider 机器人关节上。
 *
 * Aider 没有人体骨骼，只有机器人关节（left_arm1..8/right_arm1..8…），所以做法是：
 * 拿 BVH 的肩/肘/腕骨骼，算出它们「相对自身 rest 的世界旋转增量」，
 * 再把这个旋转投影到 Aider 对应关节的转轴上，得到该关节的角度。
 * 左右取反（右臂轴向左镜像）。
 *
 * 纯 three.js 模块，不依赖 Vue。
 */
import * as THREE from 'three'
import { indexBones, normBone } from './motionRetarget'

/**
 * BVH 源骨骼 → Aider 关节映射。
 *
 * 语义与限位的权威来源（不要凭外观猜）：
 *   - 关节语义：aider_terminal/src/robots/aider/adapter.py 头部注释
 *       arm1=肩pan  arm2=肩lift  arm3=肘屈伸  arm4=前臂旋转
 *       arm5=腕roll  arm6=腕pitch  arm7=腕yaw  arm8=夹爪(arm12=-arm8 联动)
 *   - 真实限位：aider_server/sql/servo_ids.yaml 的 min_angle/max_angle（度），
 *     左右互为镜像（如左 arm2=[-3,90]、右 arm2=[-90,3]），证实"右侧取反"符号规则。
 * 因此对应关系是：肩→arm1+arm2、肘→arm3+arm4、腕→arm5+arm6+arm7。
 *
 * ⚠️ key 必须用 indexBones 的归一化名（小写、无符号），写 lShldr 会一个都匹配不上
 */
export const ARM_JOINTS = {
  lshldr: ['left_arm1', 'left_arm2'],
  lforearm: ['left_arm3', 'left_arm4'],
  lhand: ['left_arm5', 'left_arm6', 'left_arm7'],
  rshldr: ['right_arm1', 'right_arm2'],
  rforearm: ['right_arm3', 'right_arm4'],
  rhand: ['right_arm5', 'right_arm6', 'right_arm7']
}

/**
 * 内置限位兜底表（度），摘自 2026-09-11 时的 servo_ids.yaml。
 * 运行时优先用 /api/get-servo-ids 拉取的最新值（见 relaxJointLimits 的 limits 参数），
 * 后端不在时才落到这张表 —— 所以 yaml 改了限位后这张表过期也不影响正确性。
 */
export const JOINT_LIMITS_DEG = {
  left_arm1: [-135, 60], left_arm2: [-3, 90], left_arm3: [-54, 91], left_arm4: [-1, 136],
  left_arm5: [-90, 90], left_arm6: [-30, 30], left_arm7: [-30, 30],
  right_arm1: [-60, 136], right_arm2: [-90, 3], right_arm3: [-90, 54], right_arm4: [-136, 1],
  right_arm5: [-90, 90], right_arm6: [-30, 30], right_arm7: [-30, 30]
}

/** 该类型机器人映射到的关节总数（火柴人演员显示的"关节数"与此一致） */
export const ARM_JOINT_COUNT = Object.values(ARM_JOINTS).reduce((n, a) => n + a.length, 0)

const DEG2RAD = Math.PI / 180

/** 胳膊骨骼 key 集合（归一化名） */
const ARM_BONE_KEYS = new Set(Object.keys(ARM_JOINTS))

/**
 * 从完整 BVH clip 里只保留肩/肘/腕的 track。
 * 火柴人"只动胳膊"时用：身体其它部位停在绑定姿势（站桩），手臂与机器人
 * 本体吃同一批源骨骼的旋转，两边才可比。
 * @returns {THREE.AnimationClip|null} 没匹配到任何胳膊 track 时返回 null（调用方回退完整 clip）
 */
export function extractArmClip(clip) {
  const tracks = clip.tracks.filter((t) => {
    const dot = t.name.indexOf('.')
    if (dot < 0) return false
    return ARM_BONE_KEYS.has(normBone(t.name.slice(0, dot)))
  })
  if (!tracks.length) return null
  return new THREE.AnimationClip(`${clip.name}-arms`, clip.duration, tracks)
}

/**
 * 把真实限位写进关节（URDF 里的 lower=upper=0 会让 setJointValue 永远钳在 0）。
 * @param {object} robot URDF robot 节点
 * @param {Record<string, [number, number]>} [limits] 关节限位表（度），
 *   一般传 /api/get-servo-ids 拉到的最新值；不传则用内置兜底表。
 */
export function relaxJointLimits(robot, limits = JOINT_LIMITS_DEG) {
  for (const [name, j] of Object.entries(robot.joints || {})) {
    const lim = JOINT_LIMITS_DEG[name]
    if (lim) {
      j.limit = { lower: lim[0] * DEG2RAD, upper: lim[1] * DEG2RAD }
    } else if (j.jointType === 'revolute' || j.jointType === 'prismatic' || j.jointType === 'continuous') {
      j.limit = { lower: -Math.PI * 2, upper: Math.PI * 2 }
    }
  }
}

/** 从模型里找出 URDF robot 节点（它身上挂着 joints 表） */
export function findUrdfRobot(root) {
  let robot = null
  root.traverse((o) => {
    if (!robot && o.joints && Object.keys(o.joints).length) robot = o
  })
  return robot
}

/**
 * 建立"骨架 → 机器人关节"的驱动器（方向对齐 / 数值 IK 版）。
 *
 * ⚠️ 必须在源骨架摆到 clip 第一帧姿势后再调用（rest 取调用那一刻的姿势）。
 * 调用方需要每帧先 updateMatrixWorld(骨架)，再调 driver.update()。
 *
 * 为什么不用"旋转增量投影到关节轴"：
 *   人体肩是球窝关节（3DOF），把它绕某根斜轴的旋转拆到 pan/lift 两根固定正交轴上，
 *   会丢掉 swing 分量又互相泄漏，机械臂总是趋向水平 —— 与火柴人对不上。
 * 这里改为直接对齐「骨骼指向」：
 *   大臂 = 肩→肘方向对齐（arm1+arm2 数值迭代）；小臂 = 肘→腕方向对齐（arm3）；
 *   前臂自转 = 绕小臂轴的 twist 分量（arm4）；腕 = 手骨旋转增量投影三轴（arm5/6/7）。
 * 所有"相对量"都以 clip 第一帧为基准，机器人零位方向经同样的旋转增量得到期望方向，
 * 与火柴人（同一 BVH、同一基准）语义一致，两边才可比。
 * @returns {{joints: number, update: () => void}}
 */
export function makeArmDriver(sourceRoot, robot) {
  robot.updateMatrixWorld(true)
  sourceRoot.updateWorldMatrix(true, true)
  const srcIdx = indexBones(sourceRoot, false)

  const arms = []
  // BVH 归一化骨骼名：left→lShldr/lForearm/lHand，right→rShldr/...（注意不是 leftshldr）
  const BONE_BY_SIDE = {
    left: ['lshldr', 'lforearm', 'lhand'],
    right: ['rshldr', 'rforearm', 'rhand']
  }
  for (const side of ['left', 'right']) {
    const [shKey, faKey, hdKey] = BONE_BY_SIDE[side]
    const sh = srcIdx[shKey] ? srcIdx[shKey][0] : null
    const fa = srcIdx[faKey] ? srcIdx[faKey][0] : null
    const hd = srcIdx[hdKey] ? srcIdx[hdKey][0] : null
    if (!sh || !fa) continue
    const J = (n) => (robot.joints || {})[`${side}_arm${n}`]
    // 实测几何（aider_pro.SLDASM.urdf，零位手臂垂直向下）：
    //   arm1 轴水平（肩前后摆）  arm2 轴竖直（肩水平摆）→ 大臂方向由这两轴决定
    //   arm3 轴竖直、arm4 轴水平（肘屈伸）      → 小臂方向由这两轴决定
    //   arm5/6/7 = 腕部三轴
    // ⚠️ adapter.py 注释里 arm1=pan/arm2=lift 的说法与 URDF 几何相反，别按注释选轴
    const jShoulder = [J(1), J(2)].filter(Boolean)
    const jForearm = [J(3), J(4)].filter(Boolean)
    const jWrist = [J(5), J(6), J(7)].filter(Boolean)
    if (!jShoulder.length) continue

    // 机器人链上的关键节点（arm1≈肩、arm3≈肘、arm5≈腕的关节原点）
    const nodeShoulder = J(1)
    const nodeElbow = J(3) || nodeShoulder
    const nodeWrist = J(5) || nodeElbow

    // BVH 第一帧方向基准（世界系）
    const s0 = sh.getWorldPosition(new THREE.Vector3())
    const f0 = fa.getWorldPosition(new THREE.Vector3())
    const bUpper0 = f0.clone().sub(s0).normalize()
    let bFore0 = null
    if (hd) {
      const h0 = hd.getWorldPosition(new THREE.Vector3())
      bFore0 = h0.clone().sub(f0).normalize()
    }

    // 机器人零位方向（构建时刻 = 关节全零）
    const mUpper0 = nodeElbow
      .getWorldPosition(new THREE.Vector3())
      .sub(nodeShoulder.getWorldPosition(new THREE.Vector3()))
      .normalize()
    const mFore0 = nodeWrist
      .getWorldPosition(new THREE.Vector3())
      .sub(nodeElbow.getWorldPosition(new THREE.Vector3()))
      .normalize()

    // 前臂/手骨的 rest（父骨系），用于 twist 与腕投影
    const relRestInvOf = (bone) => {
      const qS = bone.getWorldQuaternion(new THREE.Quaternion())
      const qP = bone.parent
        ? bone.parent.getWorldQuaternion(new THREE.Quaternion())
        : new THREE.Quaternion()
      return qP.invert().multiply(qS).invert()
    }
    const foreRestInv = relRestInvOf(fa)
    const handRestInv = hd ? relRestInvOf(hd) : null

    const cur = new Map()   // 关节名 → 当前角（rad）
    const angleOf = (j) => {
      if (!cur.has(j.name)) cur.set(j.name, j.angle || 0)
      return cur.get(j.name)
    }
    const setAngle = (j, v) => {
      const lim = j.limit || { lower: -Math.PI * 2, upper: Math.PI * 2 }
      const c = Math.min(lim.upper, Math.max(lim.lower, v))
      cur.set(j.name, c)
      j.setJointValue(c)
    }

    arms.push({
      side, sh, fa, hd, jShoulder, jForearm, jWrist,
      nodeShoulder, nodeElbow, nodeWrist,
      bUpper0, bFore0, mUpper0, mFore0,
      foreRestInv, handRestInv, angleOf, setAngle, cur,
      dWant: new THREE.Vector3(),
      fWant: new THREE.Vector3()
    })
  }

  const _qA = new THREE.Quaternion()
  const _qB = new THREE.Quaternion()
  const _qC = new THREE.Quaternion()
  const _qE = new THREE.Quaternion()
  const _qW = new THREE.Quaternion()
  const _vA = new THREE.Vector3()
  const _vB = new THREE.Vector3()
  const _vC = new THREE.Vector3()

  /** q 绕世界轴 axis 的等效转角 */
  function twistAngle(q, axis) {
    const dot = q.x * axis.x + q.y * axis.y + q.z * axis.z
    return 2 * Math.atan2(dot, Math.abs(q.w))
  }

  /** 关节的世界轴（每帧现算：近端关节转动后远端轴跟随变化） */
  function worldAxis(j) {
    j.getWorldQuaternion(_qE)
    return (j.axis ? j.axis.clone() : new THREE.Vector3(0, 0, 1)).applyQuaternion(_qE).normalize()
  }

  /** 骨骼相对 rest 的旋转增量，转到世界系 */
  function relDeltaWorld(bone, restInv, out) {
    bone.getWorldQuaternion(_qA)
    if (bone.parent) bone.parent.getWorldQuaternion(_qB)
    else _qB.identity()
    _qC.copy(_qB).invert()
    out.copy(_qC).multiply(_qA).multiply(restInv)  // 父骨系增量
    out.premultiply(_qB)                           // Qp·d
    out.multiply(_qC)                              // Qp·d·Qp⁻¹
  }

  /**
   * 方向对齐迭代：让 nodeFrom→nodeTo 的指向追上 want。
   * 与臂向共线的轴会被跳过（绕自身轴转不改变指向，增量只会白白顶到限位）。
   */
  function ikAlign(a, joints, nodeFrom, nodeTo, want, step, iters) {
    if (!want) return
    for (let k = 0; k < iters; k++) {
      nodeFrom.getWorldPosition(_vA)
      nodeTo.getWorldPosition(_vB)
      _vC.subVectors(_vB, _vA).normalize()
      if (_vC.angleTo(want) < 0.01) return
      _qB.setFromUnitVectors(_vC, want)
      for (const j of joints) {
        const ax = worldAxis(j)
        if (Math.abs(ax.dot(_vC)) > 0.95) continue
        a.setAngle(j, a.angleOf(j) + step * twistAngle(_qB, ax))
      }
      robot.updateMatrixWorld(true)
    }
  }

  // —— 预对齐：把机器人摆到 BVH 第一帧对应的姿势，作为整个动作的 rest ——
  // BVH 第一帧（这套素材是 T-pose 平举）与机器人零位（垂臂）不同；若不从第一帧姿势
  // 出发，"相对第一帧的增量"会映射到错误的方向语义（T-pose→垂臂的 87° 会变成水平摆）。
  for (const a of arms) {
    ikAlign(a, a.jShoulder, a.nodeShoulder, a.nodeElbow, a.bUpper0, 0.6, 30)
    if (a.bFore0) ikAlign(a, a.jForearm, a.nodeElbow, a.nodeWrist, a.bFore0, 0.6, 30)
    // rest 方向 = 第一帧姿势下机器人的实际臂向
    a.nodeShoulder.getWorldPosition(_vA)
    a.nodeElbow.getWorldPosition(_vB)
    a.mUpper0.subVectors(_vB, _vA).normalize()
    a.nodeElbow.getWorldPosition(_vA)
    a.nodeWrist.getWorldPosition(_vB)
    a.mFore0.subVectors(_vB, _vA).normalize()
    a.restAngles = new Map(a.cur)
  }

  return {
    joints: arms.reduce(
      (n, a) => n + a.jShoulder.length + a.jForearm.length + a.jWrist.length,
      0
    ),
    /** 关节回到第一帧姿势（重播/seek 跳变时调用，否则 IK 会从遗留姿势慢慢爬回，看起来像乱动） */
    reset() {
      for (const a of arms) {
        a.cur.clear()
        for (const [name, v] of a.restAngles) {
          a.cur.set(name, v)
          robot.joints?.[name]?.setJointValue(v)
        }
      }
      robot.updateMatrixWorld(true)
    },
    update() {
      for (const a of arms) {
        // —— 1) 大臂方向对齐（arm1 前后摆 + arm2 水平摆）——
        a.sh.getWorldPosition(_vA)
        a.fa.getWorldPosition(_vB)
        _vC.subVectors(_vB, _vA).normalize()
        _qA.setFromUnitVectors(a.bUpper0, _vC)
        a.dWant.copy(a.mUpper0).applyQuaternion(_qA)
        ikAlign(a, a.jShoulder, a.nodeShoulder, a.nodeElbow, a.dWant, 0.9, 3)

        // —— 2) 小臂方向对齐（arm3 水平摆 + arm4 肘屈伸）——
        if (a.jForearm.length && a.bFore0 && a.hd) {
          a.fa.getWorldPosition(_vA)
          a.hd.getWorldPosition(_vB)
          _vC.subVectors(_vB, _vA).normalize()
          _qA.setFromUnitVectors(a.bFore0, _vC)
          a.fWant.copy(a.mFore0).applyQuaternion(_qA)
          ikAlign(a, a.jForearm, a.nodeElbow, a.nodeWrist, a.fWant, 0.9, 3)
        }

        // —— 3) 腕（arm5/6/7，手骨旋转增量投影三轴，绝对量）——
        if (a.jWrist.length && a.hd && a.handRestInv) {
          relDeltaWorld(a.hd, a.handRestInv, _qW)
          for (const j of a.jWrist) {
            a.setAngle(j, twistAngle(_qW, worldAxis(j)))
          }
        }
      }
    }
  }
}
