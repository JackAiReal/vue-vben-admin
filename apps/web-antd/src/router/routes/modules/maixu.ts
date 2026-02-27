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
    ],
  },
];

export default routes;
