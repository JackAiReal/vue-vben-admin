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
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import {
  deleteRoomOrderById,
  exportRoomOrdersExcel,
  queryRoomOrders,
  type QueryRoomOrderParams,
  type RoomOrderRecord,
  updateRoomOrderById,
  upsertRoomOrder,
} from '#/api/maixu/order-query';
import { appendOperationLog } from '#/api/maixu/operation-log';

const { RangePicker } = DatePicker;

const accessStore = useAccessStore();
const userStore = useUserStore();

const loading = ref(false);
const rows = ref<RoomOrderRecord[]>([]);
const total = ref(0);

const paginationCurrent = ref(1);
const paginationPageSize = ref(20);

const queryState = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  keywordFields: ['time_hour', 'wxids'],
  keywordsText: '',
  roomWxid: '',
  timeRange: undefined as [Dayjs, Dayjs] | undefined,
  type: '',
});

const keywordFieldOptions = [
  { label: '群名称', value: 'room_name' },
  { label: '群ID', value: 'room_wxid' },
  { label: '日期', value: 'date' },
  { label: '类型', value: 'type' },
  { label: '时间段', value: 'time_hour' },
  { label: '麦序列表', value: 'wxids' },
];

const typeOptions = [
  { label: '全部', value: '' },
  { label: '麦序统计', value: '麦序统计' },
  { label: '打卡记录', value: '打卡记录' },
  { label: 'normal', value: 'normal' },
  { label: 'happy', value: 'happy' },
  { label: 'custom', value: 'custom' },
];

const columns: TableColumnsType<RoomOrderRecord> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '群名称', dataIndex: 'room_name', key: 'room_name', width: 180, ellipsis: true },
  { title: '群ID', dataIndex: 'room_wxid', key: 'room_wxid', width: 230, ellipsis: true },
  { title: '日期', dataIndex: 'date', key: 'date', width: 110 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 110 },
  { title: '时段', dataIndex: 'time_hour', key: 'time_hour', width: 100 },
  { title: '麦序数据', key: 'wxids', width: 260 },
  { title: '更新时间', dataIndex: 'update_time', key: 'update_time', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right', width: 150 },
];

const formModalOpen = ref(false);
const formSaving = ref(false);
const editingRecordId = ref<number | null>(null);

const formState = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  room_name: '',
  room_wxid: '',
  time_hour: '',
  type: 'normal',
  update_time: '',
  wxidsText: '',
});

const isEditing = computed(() => editingRecordId.value !== null);

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

const canEditOrder = computed(() => hasCode('MX_ORDER_EDIT'));

function asRow(record: Record<string, any>) {
  return record as RoomOrderRecord;
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

function buildQueryParams(page = paginationCurrent.value, pageSize = paginationPageSize.value): QueryRoomOrderParams {
  const range = queryState.timeRange;
  const hasRange = !!(range && range.length === 2);
  const start = hasRange ? toDateText(range?.[0]?.startOf('day')) : undefined;
  const end = hasRange ? toDateText(range?.[1]?.endOf('day')) : undefined;

  return {
    date: hasRange ? undefined : queryState.date,
    end,
    keywordFields: queryState.keywordFields,
    keywords: splitKeywords(queryState.keywordsText),
    page,
    pageSize,
    roomWxid: queryState.roomWxid.trim(),
    start,
    type: queryState.type || undefined,
  };
}

async function loadData(page = paginationCurrent.value, pageSize = paginationPageSize.value) {
  if (!queryState.roomWxid.trim()) {
    message.warning('请先输入群ID');
    return;
  }

  loading.value = true;
  try {
    const result = await queryRoomOrders(buildQueryParams(page, pageSize));
    rows.value = result.list;
    total.value = result.total;
    paginationCurrent.value = result.page;
    paginationPageSize.value = result.pageSize;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '查询失败';
    message.error(errorMessage);
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  queryState.date = dayjs().format('YYYY-MM-DD');
  queryState.keywordFields = ['time_hour', 'wxids'];
  queryState.keywordsText = '';
  queryState.timeRange = undefined;
  queryState.type = '';
}

function handleTableChange(pagination: TablePaginationConfig) {
  const nextPage = pagination.current ?? 1;
  const nextPageSize = pagination.pageSize ?? 20;
  loadData(nextPage, nextPageSize);
}

async function onExportExcel() {
  if (!queryState.roomWxid.trim()) {
    message.warning('请先输入群ID');
    return;
  }

  try {
    const { blob, filename } = await exportRoomOrdersExcel(buildQueryParams(1, 5000));
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    message.success('Excel 导出成功');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '导出失败';
    message.error(errorMessage);
  }
}

function openCreateModal() {
  if (!canEditOrder.value) {
    message.warning('当前账号无编辑麦序记录权限');
    return;
  }
  editingRecordId.value = null;
  formState.room_wxid = queryState.roomWxid.trim();
  formState.room_name = '';
  formState.date = queryState.date || dayjs().format('YYYY-MM-DD');
  formState.type = queryState.type || 'normal';
  formState.time_hour = '';
  formState.wxidsText = '';
  formState.update_time = '';
  formModalOpen.value = true;
}

function openEditModal(record: RoomOrderRecord) {
  if (!canEditOrder.value) {
    message.warning('当前账号无编辑麦序记录权限');
    return;
  }
  editingRecordId.value = record.id;
  formState.room_wxid = record.room_wxid;
  formState.room_name = record.room_name;
  formState.date = record.date;
  formState.type = record.type;
  formState.time_hour = record.time_hour;
  formState.wxidsText = (record.wxids || []).join(',');
  formState.update_time = record.update_time;
  formModalOpen.value = true;
}

function parseWxidsText(value: string) {
  return value
    .replace(/，/g, ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function submitForm() {
  if (!canEditOrder.value) {
    message.warning('当前账号无编辑麦序记录权限');
    return;
  }
  if (!formState.room_wxid.trim()) {
    message.warning('群ID不能为空');
    return;
  }
  if (!formState.room_name.trim()) {
    message.warning('群名称不能为空');
    return;
  }
  if (!formState.time_hour.trim()) {
    message.warning('时段不能为空');
    return;
  }
  if (!formState.type.trim()) {
    message.warning('类型不能为空');
    return;
  }

  const wxids = parseWxidsText(formState.wxidsText);

  formSaving.value = true;
  try {
    if (isEditing.value && editingRecordId.value !== null) {
      const result = await updateRoomOrderById({
        date: formState.date,
        id: editingRecordId.value,
        room_name: formState.room_name,
        room_wxid: formState.room_wxid,
        time_hour: formState.time_hour,
        type: formState.type,
        update_time: formState.update_time || undefined,
        wxids,
      });
      await appendOperationLog('麦序查询', '修改麦序记录', { room_wxid: formState.room_wxid, date: formState.date, type: formState.type, time_hour: formState.time_hour });
      message.success(result.msg);
    } else {
      const result = await upsertRoomOrder({
        date: formState.date,
        room_name: formState.room_name,
        room_wxid: formState.room_wxid,
        time_hour: formState.time_hour,
        type: formState.type,
        update_time: formState.update_time || undefined,
        wxids,
      });
      await appendOperationLog('麦序查询', '新增麦序记录', { room_wxid: formState.room_wxid, date: formState.date, type: formState.type, time_hour: formState.time_hour });
      message.success(result.msg);
    }

    formModalOpen.value = false;
    await loadData(1, paginationPageSize.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '保存失败';
    message.error(errorMessage);
  } finally {
    formSaving.value = false;
  }
}

async function onDelete(record: RoomOrderRecord) {
  if (!canEditOrder.value) {
    message.warning('当前账号无编辑麦序记录权限');
    return;
  }
  try {
    const msg = await deleteRoomOrderById(record.id);
    await appendOperationLog('麦序查询', '删除麦序记录', { id: record.id, room_wxid: record.room_wxid, date: record.date });
    message.success(msg);
    await loadData(paginationCurrent.value, paginationPageSize.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '删除失败';
    message.error(errorMessage);
  }
}
</script>

<template>
  <Page
    description="默认查询当天，支持时间范围、多关键词、多字段筛选，并可导出Excel。"
    title="麦序查询"
  >
    <Card class="mb-4">
      <div class="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-6 md:grid-cols-3">
        <Input
          v-model:value="queryState.roomWxid"
          placeholder="输入群ID（必填）"
          @press-enter="() => loadData(1, paginationPageSize)"
        />

        <Input
          v-model:value="queryState.date"
          placeholder="查询日期，例：2026-02-27"
        />

        <Select
          v-model:value="queryState.type"
          :options="typeOptions"
          placeholder="类型"
        />

        <RangePicker
          v-model:value="queryState.timeRange"
          :show-time="false"
          format="YYYY-MM-DD"
          style="width: 100%"
        />

        <Select
          v-model:value="queryState.keywordFields"
          :max-tag-count="2"
          :options="keywordFieldOptions"
          mode="multiple"
          placeholder="关键字字段"
        />

        <Input
          v-model:value="queryState.keywordsText"
          placeholder="多个关键字（空格/逗号分隔）"
        />
      </div>

      <Space>
        <Button type="primary" @click="loadData(1, paginationPageSize)">查询</Button>
        <Button @click="resetFilters">重置筛选</Button>
        <Button @click="onExportExcel">导出Excel</Button>
        <Button type="dashed" :disabled="!canEditOrder" @click="openCreateModal">新增麦序</Button>
      </Space>
    </Card>

    <Card>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="tablePagination"
        :scroll="{ x: 1450 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'wxids'">
            <div v-if="asRow(record).wxids_text" class="max-w-[320px] whitespace-pre-wrap text-xs leading-5">
              {{ asRow(record).wxids_text }}
            </div>
            <div v-else class="max-w-[300px] flex flex-wrap gap-1">
              <Tag
                v-for="(name, idx) in asRow(record).wx_names"
                :key="`${asRow(record).id}-name-${idx}`"
                color="cyan"
              >
                {{ name }}
              </Tag>
              <span v-if="asRow(record).wx_names.length === 0">-</span>
            </div>
          </template>

          <template v-else-if="column.key === 'type'">
            <Tag color="blue">{{ asRow(record).type }}</Tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <Space>
              <Button size="small" type="link" :disabled="!canEditOrder" @click="openEditModal(asRow(record))">修改</Button>
              <Popconfirm
                title="确认删除这条麦序数据吗？"
                @confirm="onDelete(asRow(record))"
              >
                <Button danger size="small" type="link" :disabled="!canEditOrder">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="formModalOpen"
      :confirm-loading="formSaving"
      :ok-button-props="{ disabled: !canEditOrder }"
      :title="isEditing ? '修改麦序数据' : '新增麦序数据'"
      width="620px"
      @ok="submitForm"
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input v-model:value="formState.room_wxid" placeholder="群ID" />
        <Input v-model:value="formState.room_name" placeholder="群名称" />
        <Input v-model:value="formState.date" placeholder="日期 YYYY-MM-DD" />
        <Input v-model:value="formState.type" placeholder="类型，例如 normal" />
        <Input v-model:value="formState.time_hour" placeholder="时段，例如 20" />
        <Input v-model:value="formState.update_time" placeholder="更新时间(可选) YYYY-MM-DD HH:mm:ss" />
      </div>
      <div class="mt-3">
        <Input.TextArea
          v-model:value="formState.wxidsText"
          :auto-size="{ minRows: 3, maxRows: 5 }"
          placeholder="麦序列表，多个值用逗号分隔"
        />
      </div>
    </Modal>
  </Page>
</template>
