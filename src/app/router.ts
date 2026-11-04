import { createRouter, createWebHashHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      component: () => import('../views/Home.vue'),
      meta: { title: '生活总览', main: true },
    },
    {
      path: '/items',
      component: () => import('../views/Items.vue'),
      meta: { title: '我的物品', main: true },
    },
    {
      path: '/items/new',
      component: () => import('../views/ItemForm.vue'),
      meta: { title: '新增物品' },
    },
    {
      path: '/items/:id/edit',
      component: () => import('../views/ItemForm.vue'),
      meta: { title: '编辑物品' },
    },
    {
      path: '/items/:id/usage/new',
      component: () => import('../views/UsageForm.vue'),
      meta: { title: '记录使用' },
    },
    {
      path: '/items/:id/usage',
      component: () => import('../views/UsageHistory.vue'),
      meta: { title: '使用历史' },
    },
    {
      path: '/items/:id',
      component: () => import('../views/ItemDetail.vue'),
      meta: { title: '物品详情' },
    },
    {
      path: '/usage/:logId/edit',
      component: () => import('../views/UsageForm.vue'),
      meta: { title: '编辑使用记录' },
    },
    {
      path: '/stats',
      component: () => import('../views/Statistics.vue'),
      meta: { title: '使用与价值', main: true },
    },
    {
      path: '/categories',
      component: () => import('../views/Categories.vue'),
      meta: { title: '分类管理' },
    },
    {
      path: '/settings',
      component: () => import('../views/Settings.vue'),
      meta: { title: '我的设置', main: true },
    },
    {
      path: '/settings/backup',
      component: () => import('../views/Backup.vue'),
      meta: { title: '备份与迁移' },
    },
    {
      path: '/recycle',
      component: () => import('../views/Recycle.vue'),
      meta: { title: '回收站' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('../views/NotFound.vue'),
      meta: { title: '页面不存在' },
    },
  ],
})
router.afterEach((to) => {
  document.title = `${String(to.meta.title)} · 物有所值`
})
