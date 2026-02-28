import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'carbon:settings',
      order: 30,
      title: '系统配置',
    },
    name: 'SystemConfig',
    path: '/system-config',
    children: [
      {
        name: 'SystemRbac',
        path: '/system-config/rbac',
        component: () => import('#/views/maixu/rbac/index.vue'),
        meta: {
          authority: ['super'],
          title: '权限分组管理',
        },
      },
      {
        name: 'SystemOperationLog',
        path: '/system-config/operation-log',
        component: () => import('#/views/system-config/operation-log/index.vue'),
        meta: {
          authority: ['admin', 'super'],
          title: '操作日志',
        },
      },
    ],
  },
];

export default routes;
