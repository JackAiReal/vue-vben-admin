<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, ref, watch } from 'vue';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { useAuthStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';

const notifications = ref<NotificationItem[]>([
  {
    id: 1,
    avatar: 'https://avatar.vercel.sh/maixu?text=MX',
    date: '5分钟前',
    isRead: false,
    message: '有 3 条过期时间调整申请待处理。',
    title: '审批中心待办提醒',
    link: '/apply-business/review',
  },
  {
    id: 2,
    avatar: 'https://avatar.vercel.sh/room?text=RM',
    date: '12分钟前',
    isRead: false,
    message: '群配置「自动欢迎」已同步到目标群。',
    title: '群配置变更成功',
    link: '/maixu/group-list',
  },
  {
    id: 3,
    avatar: 'https://avatar.vercel.sh/keyword?text=KW',
    date: '30分钟前',
    isRead: false,
    message: '关键字统计任务已完成，生成 1 份报表。',
    title: '统计任务完成',
    link: '/maixu/keyword-stat',
  },
  {
    id: 4,
    avatar: 'https://avatar.vercel.sh/system?text=SY',
    date: '1小时前',
    isRead: true,
    message: '签名校验拦截 2 次异常请求，请复核来源。',
    title: '系统日志告警',
    link: '/system-config/system-log',
  },
  {
    id: 5,
    avatar: 'https://avatar.vercel.sh/order?text=OD',
    date: '2小时前',
    isRead: true,
    message: '点击可直接进入麦序查询页。',
    title: '快捷入口：麦序查询',
    link: '/maixu/order-query',
  },
  {
    id: 6,
    avatar: 'https://avatar.vercel.sh/user?text=US',
    date: '2小时前',
    isRead: true,
    message: '点击可直接进入用户群绑定管理页。',
    title: '快捷入口：用户群列表',
    link: '/maixu-user/group-list',
  },
]);

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const showDot = computed(() =>
  notifications.value.some((item) => !item.isRead),
);

const menus = computed(() => []);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

const userEmail = computed(() => userStore.userInfo?.email || '未设置邮箱');

async function handleLogout() {
  await authStore.logout(false);
}

function handleNoticeClear() {
  notifications.value = [];
}

function markRead(id: number | string) {
  const item = notifications.value.find((item) => item.id === id);
  if (item) {
    item.isRead = true;
  }
}

function remove(id: number | string) {
  notifications.value = notifications.value.filter((item) => item.id !== id);
}

function handleMakeAll() {
  notifications.value.forEach((item) => (item.isRead = true));
}
watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
  }),
  async ({ enable, content }) => {
    if (enable) {
      await updateWatermark({
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        :description="userEmail"
        tag-text="运营后台"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
