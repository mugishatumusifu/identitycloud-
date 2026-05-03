import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  // ── Admin (declared BEFORE the catch-all schoolSlug routes) ──────────────
  {
    path: '/admin',
    name: 'admin-login',
    component: () => import('@/views/AdminLogin.vue'),
  },
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('@/views/AdminDashboard.vue'),
    beforeEnter: (_to, _from, next) => {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('ic_admin_token')) next()
      else next({ name: 'admin-login' })
    },
  },
  {
    path: '/:schoolSlug/:studentId',
    name: 'verify',
    component: () => import('@/views/VerifyView.vue'),
    props: true,
  },
  {
    path: '/:schoolSlug',
    name: 'school',
    component: () => import('@/views/SchoolView.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } },
})

export default router
