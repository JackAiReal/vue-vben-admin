import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'solar:users-group-two-rounded-bold-duotone',
      order: 21,
      title: '麦序机器人-用户',
    },
    name: 'MaixuUser',
    path: '/maixu-user',
    children: [
      {
        name: 'MaixuUserGroupList',
        path: '/maixu-user/group-list',
        component: () => import('#/views/maixu-user/group-list/index.vue'),
        meta: {
          title: '群列表',
        },
      },
      {
        name: 'MaixuUserOrderRecord',
        path: '/maixu-user/order-record',
        component: () => import('#/views/maixu-user/order-record/index.vue'),
        meta: {
          title: '麦序记录',
        },
      },
      {
        name: 'MaixuUserKeywordStat',
        path: '/maixu-user/keyword-stat',
        component: () => import('#/views/maixu-user/keyword-stat/index.vue'),
        meta: {
          title: '关键字统计',
        },
      },
      {
        name: 'MaixuUserTopCard',
        path: '/maixu-user/top-card',
        component: () => import('#/views/maixu-user/top-card/index.vue'),
        meta: {
          title: '置顶卡设置',
        },
      },
    ],
  },
];

export default routes;
