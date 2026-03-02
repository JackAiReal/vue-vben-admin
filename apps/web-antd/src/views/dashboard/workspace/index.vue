<script lang="ts" setup>
import type {
  WorkbenchProjectItem,
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  AnalysisChartCard,
  WorkbenchHeader,
  WorkbenchProject,
  WorkbenchQuickNav,
  WorkbenchTodo,
  WorkbenchTrends,
} from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import AnalyticsVisitsSource from '../analytics/analytics-visits-source.vue';

const userStore = useUserStore();

const projectItems: WorkbenchProjectItem[] = [
  {
    color: '#2563eb',
    content: '统一维护群配置、机器人状态与权限策略。',
    date: '2026-03-02',
    group: '运营核心',
    icon: 'solar:users-group-rounded-bold-duotone',
    title: '群列表管理',
    url: '/maixu/group-list',
  },
  {
    color: '#16a34a',
    content: '支持按群、时间、用户维度快速检索麦序记录。',
    date: '2026-03-02',
    group: '数据查询',
    icon: 'solar:document-text-bold-duotone',
    title: '麦序查询',
    url: '/maixu/order-query',
  },
  {
    color: '#f59e0b',
    content: '统计高频关键词，辅助活动运营与风控分析。',
    date: '2026-03-02',
    group: '数据分析',
    icon: 'solar:chart-bold-duotone',
    title: '关键字统计',
    url: '/maixu/keyword-stat',
  },
  {
    color: '#dc2626',
    content: '统一管理置顶卡模板及发送策略，保证触达效果。',
    date: '2026-03-02',
    group: '内容运营',
    icon: 'solar:bookmark-square-bold-duotone',
    title: '置顶卡设置',
    url: '/maixu/top-card',
  },
  {
    color: '#7c3aed',
    content: '面向业务侧账号，管理群绑定、查询与配置能力。',
    date: '2026-03-02',
    group: '用户侧运营',
    icon: 'solar:user-check-bold-duotone',
    title: '用户群列表',
    url: '/maixu-user/group-list',
  },
  {
    color: '#0f766e',
    content: '完整记录关键操作和异常拦截，满足审计追踪。',
    date: '2026-03-02',
    group: '系统治理',
    icon: 'solar:shield-check-bold-duotone',
    title: '系统日志',
    url: '/system-config/system-log',
  },
];

const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#1d4ed8',
    icon: 'ion:home-outline',
    title: '运营概览',
    url: '/analytics',
  },
  {
    color: '#dc2626',
    icon: 'ion:people-outline',
    title: '群列表管理',
    url: '/maixu/group-list',
  },
  {
    color: '#16a34a',
    icon: 'ion:list-outline',
    title: '麦序查询',
    url: '/maixu/order-query',
  },
  {
    color: '#f59e0b',
    icon: 'ion:stats-chart-outline',
    title: '关键字统计',
    url: '/maixu/keyword-stat',
  },
  {
    color: '#7c3aed',
    icon: 'ion:git-pull-request-outline',
    title: '提交申请',
    url: '/apply-business/submit',
  },
  {
    color: '#0f766e',
    icon: 'ion:settings-outline',
    title: '系统日志',
    url: '/system-config/system-log',
  },
];

const todoItems = ref<WorkbenchTodoItem[]>([
  {
    completed: false,
    content: '核对异常群配置并确认是否需要暂停机器人服务。',
    date: '2026-03-02 10:30:00',
    title: '处理群配置异常告警',
  },
  {
    completed: false,
    content: '复核今日待审批申请，优先处理即将超时单据。',
    date: '2026-03-02 11:00:00',
    title: '审批任务处理',
  },
  {
    completed: true,
    content: '完成签名拦截日志抽样，确认无误报。',
    date: '2026-03-02 09:20:00',
    title: '签名风控巡检',
  },
  {
    completed: false,
    content: '导出麦序报表并同步给运营团队复盘。',
    date: '2026-03-02 16:00:00',
    title: '生成运营日报',
  },
  {
    completed: false,
    content: '检查邮件通知配置，确保审批提醒正常送达。',
    date: '2026-03-02 17:30:00',
    title: '通知链路检查',
  },
]);

const trendItems: WorkbenchTrendItem[] = [
  {
    avatar: 'svg:avatar-1',
    content: '在 <a>麦序机器人/群列表</a> 更新了群配置。',
    date: '刚刚',
    title: '运营账号A',
  },
  {
    avatar: 'svg:avatar-2',
    content: '在 <a>申请业务/我的审批</a> 处理了 1 条申请。',
    date: '18分钟前',
    title: '审批账号B',
  },
  {
    avatar: 'svg:avatar-3',
    content: '在 <a>系统配置/系统日志</a> 新增风控审计记录。',
    date: '35分钟前',
    title: '系统账号C',
  },
  {
    avatar: 'svg:avatar-4',
    content: '在 <a>麦序机器人/麦序查询</a> 导出了运营报表。',
    date: '1小时前',
    title: '运营账号D',
  },
  {
    avatar: 'svg:avatar-1',
    content: '在 <a>麦序机器人-用户/群列表</a> 完成群绑定。',
    date: '2小时前',
    title: '业务账号E',
  },
  {
    avatar: 'svg:avatar-2',
    content: '在 <a>系统配置/通知设置</a> 更新了审批邮件模板。',
    date: '今天 09:20',
    title: '管理员',
  },
];

const router = useRouter();

function navTo(nav: WorkbenchProjectItem | WorkbenchQuickNavItem) {
  if (nav.url?.startsWith('http')) {
    openWindow(nav.url);
    return;
  }
  if (nav.url?.startsWith('/')) {
    router.push(nav.url).catch((error) => {
      console.error('Navigation failed:', error);
    });
  } else {
    console.warn(`Unknown URL for navigation item: ${nav.title} -> ${nav.url}`);
  }
}
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>
        你好，{{ userStore.userInfo?.realName }}，开始处理今日语聊运营任务。
      </template>
      <template #description>
        当前服务状态：前端在线 · 代理在线 · 后端在线
      </template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full lg:w-3/5">
        <WorkbenchProject :items="projectItems" title="核心功能" @click="navTo" />
        <WorkbenchTrends :items="trendItems" class="mt-5" title="最新动态" />
      </div>
      <div class="w-full lg:w-2/5">
        <WorkbenchQuickNav
          :items="quickNavItems"
          class="mt-5 lg:mt-0"
          title="快捷导航"
          @click="navTo"
        />
        <WorkbenchTodo :items="todoItems" class="mt-5" title="待办事项" />
        <AnalysisChartCard class="mt-5" title="访问来源">
          <AnalyticsVisitsSource />
        </AnalysisChartCard>
      </div>
    </div>
  </div>
</template>
