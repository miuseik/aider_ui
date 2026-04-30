import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/user/Login.vue')
  },
  {
    path: '/',
    component: () => import('../layout/AppLayout.vue'),
    children: [
      {
        path: '/',
        name: 'index',
        component: () => import('../views/Index.vue')
      },
      {
        path: '/vr-entrance',
        name: 'VrEntrance',
        component: () => import('../views/VrEntrance.vue')
      },
      {
        path: '/vr-scene',
        name: 'VrScene',
        component: () => import('../views/VrScene.vue')
      },
      {
        path: '/servo-manager',
        name: 'ServoManager',
        component: () => import('../views/ServoManager.vue')
      },
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('../views/user/Profile.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
