import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import VrEntrance from '../views/VrEntrance.vue'
import VrScene from '../views/VrScene.vue'
import Calibration from '../views/Calibration.vue'

const routes = [
  {
    path: '/',
    name: 'Index',
    component: Index
  },
  {
    path: '/vr-entrance',
    name: 'VrEntrance',
    component: VrEntrance
  },
  {
    path: '/vr-scene',
    name: 'VrScene',
    component: VrScene
  },
  {
    path: '/calibration',
    name: 'Calibration',
    component: Calibration
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
