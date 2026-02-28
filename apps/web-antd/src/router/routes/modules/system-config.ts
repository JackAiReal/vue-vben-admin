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
        name: 'SystemUserManage',
        path: '/system-config/user-manage',
        component: () => import('#/views/system-config/user-manage/index.vue'),
        meta: {
          authority: ['super'],
          title: '用户管理',
        },
      },
      {
        name: 'SystemNotifySettings',
        path: '/system-config/notify-settings',
        component: () =>
          import('#/views/system-config/notify-settings/index.vue'),
        meta: {
          authority: ['super'],
          title: '通知设置',
        },
      },
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
        component: () =>
          import('#/views/system-config/operation-log/index.vue'),
        meta: {
          authority: ['admin', 'super', 'user'],
          title: '操作日志',
        },
      },
    ],
  },
];

export default routes;
