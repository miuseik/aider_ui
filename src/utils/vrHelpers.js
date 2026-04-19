import * as THREE from 'three'

// 创建坐标轴指示器（X=红, Y=绿, Z=蓝）
export function createAxisIndicators(handEntity, prefix) {
  const axisLength = 0.15
  const axisRadius = 0.005

  // X 轴（红色）
  const xAxisGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
  const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial)
  xAxis.rotation.z = -Math.PI / 2
  xAxis.position.set(axisLength / 2, 0, 0)
  handEntity.object3D.add(xAxis)

  // Y 轴（绿色）
  const yAxisGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial)
  yAxis.position.set(0, axisLength / 2, 0)
  handEntity.object3D.add(yAxis)

  // Z 轴（蓝色）
  const zAxisGeometry = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 8)
  const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff })
  const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial)
  zAxis.rotation.x = Math.PI / 2
  zAxis.position.set(0, 0, axisLength / 2)
  handEntity.object3D.add(zAxis)

  console.log(`${prefix}手坐标轴指示器已创建`)
}
