import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'solar:document-add-bold-duotone',
      order: 23,
      title: '申请业务',
    },
    name: 'ApplyBusiness',
    path: '/apply-business',
    children: [
      {
        name: 'ApplyBusinessSubmit',
        path: '/apply-business/submit',
        component: () => import('#/views/apply-business/submit/index.vue'),
        meta: {
          title: '提交申请',
        },
      },
      {
        name: 'ApplyBusinessMine',
        path: '/apply-business/mine',
        component: () => import('#/views/apply-business/mine/index.vue'),
        meta: {
          title: '我的申请',
        },
      },
      {
        name: 'ApplyBusinessReview',
        path: '/apply-business/review',
        component: () => import('#/views/apply-business/review/index.vue'),
        meta: {
          title: '我的审批',
        },
      },
    ],
  },
];

export default routes;
