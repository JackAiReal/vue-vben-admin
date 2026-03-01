<script lang="ts" setup>
import type { Dayjs } from 'dayjs';
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import {
  querySystemLogs,
  type SystemLogItem,
  type SystemLogLevel,
} from '#/api/maixu/system-log';

const { RangePicker } = DatePicker;

const loading = ref(false);
const rows = ref<SystemLogItem[]>([]);
const total = ref(0);
const paginationCurrent = ref(1);
const paginationPageSize = ref(20);

const queryState = reactive({
  keyword: '',
  level: '' as '' | SystemLogLevel,
  source: '',
  timeRange: undefined as [Dayjs, Dayjs] | undefined,
  username: '',
});

const levelOptions = [
  { label: '全部级别', value: '' },
  { label: 'INFO', value: 'info' },
  { label: 'WARN', value: 'warn' },
  { label: 'ERROR', value: 'error' },
];

const columns: TableColumnsType<SystemLogItem> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
  { title: '级别', dataIndex: 'level', key: 'level', width: 100 },
  { title: '来源', dataIndex: 'source', key: 'source', width: 170, ellipsis: true },
  { title: '内容', dataIndex: 'message', key: 'message', width: 300, ellipsis: true },
  { title: '账号', dataIndex: 'username', key: 'username', width: 120 },
  { title: '详情', key: 'detailJson', width: 320 },
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
];

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: paginationCurrent.value,
  pageSize: paginationPageSize.value,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (value) => `共 ${value} 条`,
  total: total.value,
}));

function asRow(record: Record<string, any>) {
  return record as SystemLogItem;
}

function toDateText(value?: Dayjs | null) {
  if (!value) {
    return '';
  }
  return value.format('YYYY-MM-DD HH:mm:ss');
}

async function loadData(
  page = paginationCurrent.value,
  pageSize = paginationPageSize.value,
) {
  loading.value = true;
  try {
    const hasRange = !!(queryState.timeRange && queryState.timeRange.length === 2);

    const result = await querySystemLogs({
      end: hasRange ? toDateText(queryState.timeRange?.[1]?.endOf('day')) : undefined,
      keyword: queryState.keyword.trim() || undefined,
      level: queryState.level || undefined,
      page,
      pageSize,
      source: queryState.source.trim() || undefined,
      start: hasRange ? toDateText(queryState.timeRange?.[0]?.startOf('day')) : undefined,
      username: queryState.username.trim() || undefined,
    });

    rows.value = result.list;
    total.value = result.total;
    paginationCurrent.value = result.page;
    paginationPageSize.value = result.pageSize;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '系统日志查询失败');
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  queryState.keyword = '';
  queryState.level = '';
  queryState.source = '';
  queryState.timeRange = undefined;
  queryState.username = '';
}

function levelColor(level: SystemLogLevel) {
  if (level === 'error') {
    return 'red';
  }
  if (level === 'warn') {
    return 'gold';
  }
  return 'blue';
}

function levelText(level: SystemLogLevel) {
  return level.toUpperCase();
}

function handleTableChange(pagination: TablePaginationConfig) {
  loadData(pagination.current ?? 1, pagination.pageSize ?? 20);
}

loadData();
</script>

<template>
  <Page title="系统日志" description="记录系统级 info/warn/error 日志，支持分页和多维筛选。">
    <Card class="mb-4">
      <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Select v-model:value="queryState.level" :options="levelOptions" placeholder="日志级别" />
        <Input v-model:value="queryState.source" placeholder="来源筛选" />
        <Input v-model:value="queryState.username" placeholder="账号筛选" />
        <RangePicker v-model:value="queryState.timeRange" format="YYYY-MM-DD" style="width: 100%" />
        <Input v-model:value="queryState.keyword" placeholder="关键字（内容/详情/来源）" />
      </div>

      <Space>
        <Button type="primary" @click="loadData(1, paginationPageSize)">查询</Button>
        <Button @click="resetQuery">重置</Button>
      </Space>
    </Card>

    <Card>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="tablePagination"
        :scroll="{ x: 1600 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'level'">
            <Tag :color="levelColor(asRow(record).level)">
              {{ levelText(asRow(record).level) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'detailJson'">
            <div class="max-w-[320px] whitespace-pre-wrap text-xs leading-5">
              {{ asRow(record).detailJson || '{}' }}
            </div>
          </template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
