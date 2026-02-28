import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'solar:microphone-2-bold-duotone',
      order: 20,
      title: '麦序机器人',
    },
    name: 'Maixu',
    path: '/maixu',
    children: [
      {
        name: 'MaixuGroupList',
        path: '/maixu/group-list',
        component: () => import('#/views/maixu/group-list/index.vue'),
        meta: {
          title: '麦序群列表',
        },
      },
      {
        name: 'MaixuOrderQuery',
        path: '/maixu/order-query',
        component: () => import('#/views/maixu/order-query/index.vue'),
        meta: {
          title: '麦序查询',
        },
      },
      {
        name: 'MaixuKeywordStat',
        path: '/maixu/keyword-stat',
        component: () => import('#/views/maixu/keyword-stat/index.vue'),
        meta: {
          title: '关键字统计',
        },
      },
      {
        name: 'MaixuTopCard',
        path: '/maixu/top-card',
        component: () => import('#/views/maixu/top-card/index.vue'),
        meta: {
          title: '置顶卡设置',
        },
      },
      {
        name: 'MaixuRbac',
        path: '/maixu/rbac',
        component: () => import('#/views/maixu/rbac/index.vue'),
        meta: {
          authority: ['super'],
          title: '权限分组管理',
        },
      },
    ],
  },
];

export default routes;
