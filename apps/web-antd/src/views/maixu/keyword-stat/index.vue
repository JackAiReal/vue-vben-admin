<script lang="ts" setup>
import type { Dayjs } from 'dayjs';
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import dayjs from 'dayjs';
import {
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import {
  deleteKeywordStatById,
  exportKeywordStatsExcel,
  queryKeywordStats,
  saveKeywordStat,
  type KeywordStatQueryParams,
  type KeywordStatRecord,
} from '#/api/maixu/keyword-stat';
import { appendOperationLog } from '#/api/maixu/operation-log';

const { RangePicker } = DatePicker;

const accessStore = useAccessStore();
const userStore = useUserStore();

const loading = ref(false);
const rows = ref<KeywordStatRecord[]>([]);
const total = ref(0);
const paginationCurrent = ref(1);
const paginationPageSize = ref(20);

const queryState = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  keywordFields: ['tag_type', 'tag_one', 'tag_home_people'],
  keywordsText: '',
  roomWxid: '',
  tagType: '',
  timeRange: undefined as [Dayjs, Dayjs] | undefined,
});

const keywordFieldOptions = [
  { label: '关键字类型', value: 'tag_type' },
  { label: '成员ID', value: 'tag_one' },
  { label: '主持昵称', value: 'tag_home_people' },
  { label: '小时', value: 'tag_hour' },
  { label: '日期', value: 'date' },
];

const tagTypeOptions = [
  { label: '全部', value: '' },
  { label: '收光', value: '收光' },
  { label: '累计', value: '累计' },
  { label: '置顶', value: '置顶' },
];

const columns: TableColumnsType<KeywordStatRecord> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '群ID', dataIndex: 'tag_room', key: 'tag_room', width: 220, ellipsis: true },
  { title: '类型', dataIndex: 'tag_type', key: 'tag_type', width: 110 },
  { title: '成员昵称', dataIndex: 'tag_one_name', key: 'tag_one_name', width: 130, ellipsis: true },
  { title: '成员ID', dataIndex: 'tag_one', key: 'tag_one', width: 180, ellipsis: true },
  { title: '数量', dataIndex: 'tag_num', key: 'tag_num', width: 90 },
  { title: '小时', dataIndex: 'tag_hour', key: 'tag_hour', width: 80 },
  { title: '主持', dataIndex: 'tag_home_people', key: 'tag_home_people', width: 100, ellipsis: true },
  { title: '日期', dataIndex: 'date', key: 'date', width: 110 },
  { title: '更新时间', dataIndex: 'update_time', key: 'update_time', width: 180 },
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

function hasCode(code: string) {
  const roles = userStore.userInfo?.roles || [];
  if (roles.includes('super')) {
    return true;
  }
  return accessStore.accessCodes.includes(code);
}

const canEditKeyword = computed(() => hasCode('MX_KEYWORD_EDIT'));

const formModalOpen = ref(false);
const formSaving = ref(false);
const editingRecord = ref<KeywordStatRecord | null>(null);

const formState = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  tag_home_people: '',
  tag_hour: 0,
  tag_num: 0,
  tag_one: '',
  tag_room: '',
  tag_type: '收光',
  update_time: '',
});

function asRow(record: Record<string, any>) {
  return record as KeywordStatRecord;
}

function splitKeywords(text: string) {
  return text
    .replace(/[\n\r\t]/g, ' ')
    .replace(/，/g, ',')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toDateText(value?: Dayjs | null) {
  if (!value) {
    return '';
  }
  return value.format('YYYY-MM-DD HH:mm:ss');
}

function buildQueryParams(page = paginationCurrent.value, pageSize = paginationPageSize.value): KeywordStatQueryParams {
  const hasRange = !!(queryState.timeRange && queryState.timeRange.length === 2);

  return {
    date: hasRange ? undefined : queryState.date,
    end: hasRange ? toDateText(queryState.timeRange?.[1]?.endOf('day')) : undefined,
    keywordFields: queryState.keywordFields,
    keywords: splitKeywords(queryState.keywordsText),
    page,
    pageSize,
    roomWxid: queryState.roomWxid.trim(),
    start: hasRange ? toDateText(queryState.timeRange?.[0]?.startOf('day')) : undefined,
    tagType: queryState.tagType || undefined,
  };
}

async function loadData(page = paginationCurrent.value, pageSize = paginationPageSize.value) {
  if (!queryState.roomWxid.trim()) {
    message.warning('请先输入群ID');
    return;
  }

  loading.value = true;
  try {
    const result = await queryKeywordStats(buildQueryParams(page, pageSize));
    rows.value = result.list;
    total.value = result.total;
    paginationCurrent.value = result.page;
    paginationPageSize.value = result.pageSize;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '查询失败');
  } finally {
    loading.value = false;
  }
}

function handleTableChange(pagination: TablePaginationConfig) {
  loadData(pagination.current ?? 1, pagination.pageSize ?? 20);
}

function resetFilters() {
  queryState.date = dayjs().format('YYYY-MM-DD');
  queryState.tagType = '';
  queryState.keywordsText = '';
  queryState.timeRange = undefined;
}

async function onExport() {
  if (!queryState.roomWxid.trim()) {
    message.warning('请先输入群ID');
    return;
  }

  try {
    const { blob, filename } = await exportKeywordStatsExcel(buildQueryParams(1, 5000));
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    message.success('导出成功');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出失败');
  }
}

function openCreateModal() {
  if (!canEditKeyword.value) {
    message.warning('当前账号无编辑关键词统计权限');
    return;
  }
  editingRecord.value = null;
  formState.tag_room = queryState.roomWxid.trim();
  formState.date = queryState.date || dayjs().format('YYYY-MM-DD');
  formState.tag_type = queryState.tagType || '收光';
  formState.tag_one = '';
  formState.tag_num = 0;
  formState.tag_hour = 0;
  formState.tag_home_people = '';
  formState.update_time = '';
  formModalOpen.value = true;
}

function openEditModal(row: KeywordStatRecord) {
  if (!canEditKeyword.value) {
    message.warning('当前账号无编辑关键词统计权限');
    return;
  }
  editingRecord.value = row;
  formState.tag_room = row.tag_room;
  formState.date = row.date;
  formState.tag_type = row.tag_type;
  formState.tag_one = row.tag_one;
  formState.tag_num = row.tag_num;
  formState.tag_hour = row.tag_hour;
  formState.tag_home_people = row.tag_home_people;
  formState.update_time = row.update_time;
  formModalOpen.value = true;
}

async function submitForm() {
  if (!canEditKeyword.value) {
    message.warning('当前账号无编辑关键词统计权限');
    return;
  }
  if (!formState.tag_room.trim() || !formState.tag_type.trim() || !formState.tag_one.trim()) {
    message.warning('群ID、关键字类型、成员ID不能为空');
    return;
  }

  formSaving.value = true;
  try {
    const result = await saveKeywordStat({
      date: formState.date,
      id: editingRecord.value?.id,
      tag_home_people: formState.tag_home_people,
      tag_hour: Number(formState.tag_hour || 0),
      tag_num: Number(formState.tag_num || 0),
      tag_one: formState.tag_one.trim(),
      tag_room: formState.tag_room.trim(),
      tag_type: formState.tag_type.trim(),
      update_time: formState.update_time || undefined,
    });
    await appendOperationLog('关键字统计', editingRecord.value ? '修改关键字统计' : '新增关键字统计', { tag_room: formState.tag_room, tag_type: formState.tag_type, tag_one: formState.tag_one, tag_num: formState.tag_num });
    message.success(result.msg);
    formModalOpen.value = false;
    await loadData(1, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    formSaving.value = false;
  }
}

async function onDelete(row: KeywordStatRecord) {
  if (!canEditKeyword.value) {
    message.warning('当前账号无编辑关键词统计权限');
    return;
  }
  try {
    const msg = await deleteKeywordStatById(row.id);
    await appendOperationLog('关键字统计', '删除关键字统计', { id: row.id, tag_room: row.tag_room, tag_type: row.tag_type });
    message.success(msg);
    await loadData(paginationCurrent.value, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
  }
}
</script>

<template>
  <Page title="关键字统计" description="按群ID查询关键字统计，支持筛选、增删改查、导出Excel。">
    <Card class="mb-4">
      <div class="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-6 md:grid-cols-3">
        <Input v-model:value="queryState.roomWxid" placeholder="输入群ID（必填）" @press-enter="() => loadData(1, paginationPageSize)" />
        <Input v-model:value="queryState.date" placeholder="查询日期 YYYY-MM-DD" />
        <Select v-model:value="queryState.tagType" :options="tagTypeOptions" placeholder="关键字类型" />
        <RangePicker v-model:value="queryState.timeRange" format="YYYY-MM-DD" style="width: 100%" />
        <Select v-model:value="queryState.keywordFields" :options="keywordFieldOptions" mode="multiple" :max-tag-count="2" placeholder="关键字字段" />
        <Input v-model:value="queryState.keywordsText" placeholder="多个关键字(空格/逗号分隔)" />
      </div>
      <Space>
        <Button type="primary" @click="loadData(1, paginationPageSize)">查询</Button>
        <Button @click="resetFilters">重置筛选</Button>
        <Button @click="onExport">导出Excel</Button>
        <Button type="dashed" :disabled="!canEditKeyword" @click="openCreateModal">新增</Button>
      </Space>
    </Card>

    <Card>
      <Table :columns="columns" :data-source="rows" :loading="loading" :pagination="tablePagination" :scroll="{ x: 1600 }" row-key="id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'tag_type'">
            <Tag color="blue">{{ asRow(record).tag_type }}</Tag>
          </template>
          <template v-else-if="column.key === 'actions'">
            <Space>
              <Button size="small" type="link" :disabled="!canEditKeyword" @click="openEditModal(asRow(record))">修改</Button>
              <Popconfirm title="确认删除这条记录吗？" @confirm="onDelete(asRow(record))">
                <Button size="small" danger type="link" :disabled="!canEditKeyword">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal v-model:open="formModalOpen" :confirm-loading="formSaving" :ok-button-props="{ disabled: !canEditKeyword }" :title="editingRecord ? '修改关键字统计' : '新增关键字统计'" width="700px" @ok="submitForm">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input v-model:value="formState.tag_room" placeholder="群ID" />
        <Input v-model:value="formState.date" placeholder="日期 YYYY-MM-DD" />
        <Input v-model:value="formState.tag_type" placeholder="关键字类型" />
        <Input v-model:value="formState.tag_one" placeholder="成员ID(wxid)" />
        <InputNumber v-model:value="formState.tag_num" :step="0.1" style="width: 100%" placeholder="数量" />
        <InputNumber v-model:value="formState.tag_hour" :min="0" :max="23" :precision="0" style="width: 100%" placeholder="小时" />
        <Input v-model:value="formState.tag_home_people" placeholder="主持昵称" />
        <Input v-model:value="formState.update_time" placeholder="更新时间(可选) YYYY-MM-DD HH:mm:ss" />
      </div>
    </Modal>
  </Page>
</template>
