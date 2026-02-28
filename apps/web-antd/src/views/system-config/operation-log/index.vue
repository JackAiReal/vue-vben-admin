<script lang="ts" setup>
import type { Dayjs } from 'dayjs';
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  DatePicker,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import {
  appendOperationLog,
  deleteOperationLog,
  queryOperationLogs,
  saveOperationLog,
  type OperationLogItem,
} from '#/api/maixu/operation-log';

const { RangePicker } = DatePicker;

const userStore = useUserStore();
const isSuper = computed(() => (userStore.userInfo?.roles || []).includes('super'));

const loading = ref(false);
const rows = ref<OperationLogItem[]>([]);
const total = ref(0);
const paginationCurrent = ref(1);
const paginationPageSize = ref(20);

const filters = reactive({
  action: '',
  keyword: '',
  pageName: '',
  timeRange: undefined as [Dayjs, Dayjs] | undefined,
  username: '',
});

const columns: TableColumnsType<OperationLogItem> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
  { title: '账号', dataIndex: 'username', key: 'username', width: 120 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
  { title: '页面', dataIndex: 'page', key: 'page', width: 150, ellipsis: true },
  { title: '操作', dataIndex: 'action', key: 'action', width: 180, ellipsis: true },
  { title: '详情', key: 'detailJson', width: 280 },
  { title: '操作时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', width: 130, fixed: 'right' },
];

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: paginationCurrent.value,
  pageSize: paginationPageSize.value,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (value) => `共 ${value} 条`,
  total: total.value,
}));


function asLog(record: Record<string, any>) {
  return record as OperationLogItem;
}

const formModalOpen = ref(false);
const formSaving = ref(false);
const editingRow = ref<OperationLogItem | null>(null);
const formState = reactive({
  action: '',
  detailJson: '{}',
  page: '',
  role: 'admin',
  username: '',
});

function toDateText(value?: Dayjs | null) {
  if (!value) {
    return '';
  }
  return value.format('YYYY-MM-DD HH:mm:ss');
}

function buildQueryParams(page = paginationCurrent.value, pageSize = paginationPageSize.value) {
  const hasRange = !!(filters.timeRange && filters.timeRange.length === 2);
  return {
    action: filters.action.trim() || undefined,
    end: hasRange ? toDateText(filters.timeRange?.[1]?.endOf('day')) : undefined,
    keyword: filters.keyword.trim() || undefined,
    page,
    pageName: filters.pageName.trim() || undefined,
    pageSize,
    start: hasRange ? toDateText(filters.timeRange?.[0]?.startOf('day')) : undefined,
    username: filters.username.trim() || undefined,
  };
}

async function loadData(page = paginationCurrent.value, pageSize = paginationPageSize.value) {
  loading.value = true;
  try {
    const result = await queryOperationLogs(buildQueryParams(page, pageSize));
    rows.value = result.list;
    total.value = result.total;
    paginationCurrent.value = result.page;
    paginationPageSize.value = result.pageSize;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载操作日志失败');
  } finally {
    loading.value = false;
  }
}

function handleTableChange(pagination: TablePaginationConfig) {
  loadData(pagination.current ?? 1, pagination.pageSize ?? 20);
}

function resetFilters() {
  filters.action = '';
  filters.keyword = '';
  filters.pageName = '';
  filters.timeRange = undefined;
  filters.username = '';
}

function openCreateModal() {
  if (!isSuper.value) {
    message.warning('仅超级管理员可新增日志');
    return;
  }
  editingRow.value = null;
  formState.username = '';
  formState.role = 'admin';
  formState.page = '';
  formState.action = '';
  formState.detailJson = '{}';
  formModalOpen.value = true;
}

function openEditModal(record: OperationLogItem) {
  if (!isSuper.value) {
    message.warning('仅超级管理员可修改日志');
    return;
  }
  editingRow.value = record;
  formState.username = record.username;
  formState.role = record.role;
  formState.page = record.page;
  formState.action = record.action;
  formState.detailJson = record.detailJson || '{}';
  formModalOpen.value = true;
}

async function submitForm() {
  if (!isSuper.value) {
    message.warning('仅超级管理员可保存日志');
    return;
  }

  if (!formState.username.trim() || !formState.page.trim() || !formState.action.trim()) {
    message.warning('账号、页面、操作不能为空');
    return;
  }

  formSaving.value = true;
  try {
    await saveOperationLog({
      action: formState.action.trim(),
      detailJson: formState.detailJson || '{}',
      id: editingRow.value?.id,
      page: formState.page.trim(),
      role: formState.role.trim() || 'admin',
      username: formState.username.trim(),
    });
    formModalOpen.value = false;
    await appendOperationLog('系统配置/操作日志', editingRow.value ? '修改日志' : '新增日志', {
      target: formState.username,
      action: formState.action,
      page: formState.page,
    });
    message.success('保存成功');
    await loadData(1, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    formSaving.value = false;
  }
}

async function removeLog(record: OperationLogItem) {
  if (!isSuper.value) {
    message.warning('仅超级管理员可删除日志');
    return;
  }

  try {
    await deleteOperationLog(record.id);
    await appendOperationLog('系统配置/操作日志', '删除日志', {
      id: record.id,
      username: record.username,
    });
    message.success('删除成功');
    await loadData(paginationCurrent.value, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
  }
}

loadData();
</script>

<template>
  <Page title="操作日志" description="记录系统修改操作：谁在什么页面做了什么。超级管理员可增删改查，普通管理员只读。">
    <Card class="mb-4">
      <div class="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-5 md:grid-cols-2">
        <Input v-model:value="filters.username" placeholder="按账号筛选" />
        <Input v-model:value="filters.pageName" placeholder="按页面筛选" />
        <Input v-model:value="filters.action" placeholder="按操作筛选" />
        <RangePicker v-model:value="filters.timeRange" format="YYYY-MM-DD" style="width: 100%" />
        <Input v-model:value="filters.keyword" placeholder="关键字搜索(账号/页面/操作/详情)" />
      </div>

      <Space>
        <Button type="primary" @click="loadData(1, paginationPageSize)">查询</Button>
        <Button @click="resetFilters">重置筛选</Button>
        <Button type="dashed" :disabled="!isSuper" @click="openCreateModal">新增日志</Button>
      </Space>
    </Card>

    <Card>
      <Table :columns="columns" :data-source="rows" :loading="loading" :pagination="tablePagination" :scroll="{ x: 1700 }" row-key="id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <Tag :color="record.role === 'super' ? 'gold' : record.role === 'admin' ? 'blue' : 'default'">
              {{ record.role }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'detailJson'">
            <div class="max-w-[280px] whitespace-pre-wrap text-xs leading-5">
              {{ record.detailJson }}
            </div>
          </template>
          <template v-else-if="column.key === 'actions'">
            <Space>
              <Button size="small" type="link" :disabled="!isSuper" @click="openEditModal(asLog(record))">修改</Button>
              <Popconfirm title="确认删除这条日志吗？" @confirm="removeLog(asLog(record))">
                <Button size="small" type="link" danger :disabled="!isSuper">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal v-model:open="formModalOpen" :confirm-loading="formSaving" :ok-button-props="{ disabled: !isSuper }" :title="editingRow ? '修改日志' : '新增日志'" width="760px" @ok="submitForm">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input v-model:value="formState.username" placeholder="账号" />
        <Select v-model:value="formState.role" :options="[{ label: 'super', value: 'super' }, { label: 'admin', value: 'admin' }, { label: 'user', value: 'user' }]" placeholder="角色" />
        <Input v-model:value="formState.page" placeholder="页面" class="md:col-span-2" />
        <Input v-model:value="formState.action" placeholder="操作" class="md:col-span-2" />
      </div>
      <div class="mt-3">
        <Input.TextArea v-model:value="formState.detailJson" :auto-size="{ minRows: 5, maxRows: 10 }" placeholder="详情 JSON" />
      </div>
    </Modal>
  </Page>
</template>
