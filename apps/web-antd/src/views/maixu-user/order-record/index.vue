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
import {
  fetchUserRoomBindings,
  type UserRoomBindingItem,
} from '#/api/maixu/user-room';

const { RangePicker } = DatePicker;
const accessStore = useAccessStore();
const userStore = useUserStore();

const loading = ref(false);
const loadingBindings = ref(false);
const rows = ref<RoomOrderRecord[]>([]);
const total = ref(0);
const boundRooms = ref<UserRoomBindingItem[]>([]);

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
  { title: '群名称', dataIndex: 'room_name', key: 'room_name', width: 190, ellipsis: true },
  { title: '群ID', dataIndex: 'room_wxid', key: 'room_wxid', width: 240, ellipsis: true },
  { title: '日期', dataIndex: 'date', key: 'date', width: 110 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 110 },
  { title: '时段', dataIndex: 'time_hour', key: 'time_hour', width: 100 },
  { title: '麦序数据', key: 'wxids', width: 300 },
  { title: '更新时间', dataIndex: 'update_time', key: 'update_time', width: 180 },
  { title: '操作', key: 'actions', fixed: 'right', width: 140 },
];

const formModalOpen = ref(false);
const formSaving = ref(false);
const editingRecordId = ref<null | number>(null);

const formState = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  room_name: '',
  room_wxid: '',
  time_hour: '',
  type: 'normal',
  update_time: '',
  wxidsText: '',
});

const currentUsername = computed(() => {
  const account = userStore.userInfo?.username || userStore.userInfo?.email || '';
  return String(account).trim();
});

function hasCode(code: string) {
  const roles = userStore.userInfo?.roles || [];
  if (roles.includes('super')) {
    return true;
  }
  return accessStore.accessCodes.includes(code);
}

const canEditOrderRecord = computed(() => hasCode('MX_USER_ORDER_EDIT'));

const isEditing = computed(() => editingRecordId.value !== null);

const roomOptions = computed(() =>
  boundRooms.value.map((item) => ({
    label: item.roomName ? `${item.roomName} (${item.roomWxid})` : item.roomWxid,
    value: item.roomWxid,
  })),
);

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: paginationCurrent.value,
  pageSize: paginationPageSize.value,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (value) => `共 ${value} 条`,
  total: total.value,
}));

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

function dedupeBindings(items: UserRoomBindingItem[]) {
  const roomMap = new Map<string, UserRoomBindingItem>();
  for (const item of items) {
    const roomWxid = String(item.roomWxid || '').trim();
    if (!roomWxid) {
      continue;
    }
    roomMap.set(roomWxid, {
      ...item,
      roomWxid,
      roomName: String(item.roomName || '').trim(),
    });
  }
  return [...roomMap.values()];
}

function findBoundRoom(roomWxid: string) {
  return boundRooms.value.find((item) => item.roomWxid === roomWxid) || null;
}

function syncFormRoomInfo(roomWxid: string) {
  const room = findBoundRoom(roomWxid);
  if (!room) {
    return;
  }
  formState.room_wxid = room.roomWxid;
  formState.room_name = room.roomName || room.roomWxid;
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

function isLikelyWxid(text: string) {
  return (
    text.includes('wxid_') ||
    text.endsWith('@chatroom') ||
    /^[a-zA-Z0-9_-]{18,}$/.test(text)
  );
}

function containsChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function resolveWxLabels(record: RoomOrderRecord) {
  if (record.wxids_text) {
    return [];
  }

  return record.wxids.map((wxid, index) => {
    const cleanWxid = String(wxid || '').trim();
    const matchedName = String(record.wx_names[index] || '').trim();
    if (matchedName && matchedName !== '未知成员') {
      return matchedName;
    }
    if (containsChinese(cleanWxid) && !isLikelyWxid(cleanWxid)) {
      return cleanWxid;
    }
    return cleanWxid || '未知成员';
  });
}

function parseWxidsText(value: string) {
  const text = value.trim();
  if (!text) {
    return [];
  }

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // keep fallback below
    }
  }

  return text
    .replace(/，/g, ',')
    .replace(/[\r\n]+/g, ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadData(page = paginationCurrent.value, pageSize = paginationPageSize.value) {
  if (!queryState.roomWxid.trim()) {
    rows.value = [];
    total.value = 0;
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

async function loadBoundRooms() {
  const username = currentUsername.value;
  if (!username) {
    message.warning('未获取到当前账号，请重新登录后重试');
    return;
  }

  loadingBindings.value = true;
  try {
    const list = await fetchUserRoomBindings(username);
    boundRooms.value = dedupeBindings(list);

    if (boundRooms.value.length === 0) {
      queryState.roomWxid = '';
      rows.value = [];
      total.value = 0;
      return;
    }

    const exists = boundRooms.value.some((item) => item.roomWxid === queryState.roomWxid);
    if (!exists) {
      queryState.roomWxid = boundRooms.value[0]?.roomWxid || '';
    }

    syncFormRoomInfo(queryState.roomWxid);
    await loadData(1, paginationPageSize.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '加载绑定群失败';
    message.error(errorMessage);
  } finally {
    loadingBindings.value = false;
  }
}

function onRoomChange(value: any) {
  const roomWxid = Array.isArray(value)
    ? String(value[0] || '').trim()
    : String(value || '').trim();
  queryState.roomWxid = roomWxid;
  syncFormRoomInfo(roomWxid);
  loadData(1, paginationPageSize.value);
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
    message.warning('请先选择群聊');
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
  if (!canEditOrderRecord.value) {
    message.warning('当前账号无麦序记录编辑权限');
    return;
  }

  if (!queryState.roomWxid) {
    message.warning('请先选择群聊');
    return;
  }

  editingRecordId.value = null;
  formState.date = queryState.date || dayjs().format('YYYY-MM-DD');
  formState.type = queryState.type || '麦序统计';
  formState.time_hour = '';
  formState.update_time = '';
  formState.wxidsText = '';
  syncFormRoomInfo(queryState.roomWxid);
  formModalOpen.value = true;
}

function openEditModal(record: RoomOrderRecord) {
  if (!canEditOrderRecord.value) {
    message.warning('当前账号无麦序记录编辑权限');
    return;
  }

  editingRecordId.value = record.id;
  formState.room_wxid = record.room_wxid;
  formState.room_name = record.room_name;
  formState.date = record.date;
  formState.type = record.type;
  formState.time_hour = record.time_hour;
  formState.wxidsText = record.wxids_text || (record.wxids || []).join(',');
  formState.update_time = record.update_time;
  formModalOpen.value = true;
}

async function submitForm() {
  if (!canEditOrderRecord.value) {
    message.warning('当前账号无麦序记录编辑权限');
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
      await appendOperationLog('麦序机器人-用户/麦序记录', '修改麦序记录', {
        id: editingRecordId.value,
        room_wxid: formState.room_wxid,
      });
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
      await appendOperationLog('麦序机器人-用户/麦序记录', '新增麦序记录', {
        room_wxid: formState.room_wxid,
        date: formState.date,
      });
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
  if (!canEditOrderRecord.value) {
    message.warning('当前账号无麦序记录编辑权限');
    return;
  }

  try {
    const msg = await deleteRoomOrderById(record.id);
    await appendOperationLog('麦序机器人-用户/麦序记录', '删除麦序记录', {
      id: record.id,
      room_wxid: record.room_wxid,
    });
    message.success(msg);
    await loadData(paginationCurrent.value, paginationPageSize.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '删除失败';
    message.error(errorMessage);
  }
}

loadBoundRooms();
</script>

<template>
  <Page
    description="按已绑定群聊自动加载麦序记录，支持新增、修改、删除、多条件筛选和导出。"
    title="麦序记录"
  >
    <Card class="mb-4">
      <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Select
          :loading="loadingBindings"
          :options="roomOptions"
          :value="queryState.roomWxid"
          allow-clear
          placeholder="选择已绑定群聊"
          show-search
          :filter-option="(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())"
          @change="onRoomChange"
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
        <Button type="dashed" :disabled="!canEditOrderRecord" @click="openCreateModal">
          新增麦序
        </Button>
      </Space>
    </Card>

    <Card>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="tablePagination"
        :scroll="{ x: 1520 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'wxids'">
            <div
              v-if="asRow(record).wxids_text"
              class="max-w-[360px] whitespace-pre-wrap text-xs leading-5"
            >
              {{ asRow(record).wxids_text }}
            </div>
            <div v-else class="flex max-w-[360px] flex-wrap gap-1">
              <Tag
                v-for="(name, idx) in resolveWxLabels(asRow(record))"
                :key="`${asRow(record).id}-wx-${idx}`"
                color="cyan"
              >
                {{ name }}
              </Tag>
              <span v-if="resolveWxLabels(asRow(record)).length === 0">-</span>
            </div>
          </template>

          <template v-else-if="column.key === 'type'">
            <Tag color="blue">{{ asRow(record).type }}</Tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <Space>
              <Button
                size="small"
                type="link"
                :disabled="!canEditOrderRecord"
                @click="openEditModal(asRow(record))"
              >
                修改
              </Button>
              <Popconfirm
                title="确认删除这条麦序数据吗？"
                @confirm="onDelete(asRow(record))"
              >
                <Button danger size="small" type="link" :disabled="!canEditOrderRecord">
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="formModalOpen"
      :confirm-loading="formSaving"
      :ok-button-props="{ disabled: !canEditOrderRecord }"
      :title="isEditing ? '修改麦序数据' : '新增麦序数据'"
      width="680px"
      @ok="submitForm"
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          v-model:value="formState.room_wxid"
          :options="roomOptions"
          placeholder="群ID"
          show-search
          :filter-option="(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())"
          @change="(roomWxid) => syncFormRoomInfo(String(roomWxid || ''))"
        />
        <Input v-model:value="formState.room_name" placeholder="群名称" />
        <Input v-model:value="formState.date" placeholder="日期 YYYY-MM-DD" />
        <Input v-model:value="formState.type" placeholder="类型，例如 麦序统计" />
        <Input v-model:value="formState.time_hour" placeholder="时段，例如 15" />
        <Input v-model:value="formState.update_time" placeholder="更新时间(可选) YYYY-MM-DD HH:mm:ss" />
      </div>
      <div class="mt-3">
        <Input.TextArea
          v-model:value="formState.wxidsText"
          :auto-size="{ minRows: 3, maxRows: 7 }"
          placeholder="麦序数据：支持逗号分隔、换行、或 JSON 数组"
        />
      </div>
    </Modal>
  </Page>
</template>
