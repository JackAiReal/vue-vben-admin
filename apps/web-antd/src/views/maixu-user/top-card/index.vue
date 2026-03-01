<script lang="ts" setup>
import type { Dayjs } from 'dayjs';
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

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

import { appendOperationLog } from '#/api/maixu/operation-log';
import {
  deleteTopCardById,
  exportTopCardsExcel,
  queryTopCards,
  saveTopCard,
  type TopCardQueryParams,
  type TopCardRecord,
} from '#/api/maixu/top-card';
import {
  fetchUserRoomBindings,
  type UserRoomBindingItem,
} from '#/api/maixu/user-room';

const { RangePicker } = DatePicker;

const accessStore = useAccessStore();
const userStore = useUserStore();

const loading = ref(false);
const loadingBindings = ref(false);
const rows = ref<TopCardRecord[]>([]);
const total = ref(0);
const boundRooms = ref<UserRoomBindingItem[]>([]);
const paginationCurrent = ref(1);
const paginationPageSize = ref(20);

const queryState = reactive({
  keywordFields: ['top_type', 'give_wxid', 'register_wxid'],
  keywordsText: '',
  roomWxid: '',
  topType: '',
  timeRange: undefined as [Dayjs, Dayjs] | undefined,
});

const keywordFieldOptions = [
  { label: '群名称', value: 'room_name' },
  { label: '置顶类型', value: 'top_type' },
  { label: 'Alan', value: 'alan_wxid' },
  { label: '注册人', value: 'register_wxid' },
  { label: '被赠与人', value: 'give_wxid' },
];

const topTypeOptions = [
  { label: '全部', value: '' },
  { label: '月置顶', value: '月置顶' },
  { label: '新人置顶', value: '新人置顶' },
  { label: '收光置顶', value: '收光置顶' },
];

const columns: TableColumnsType<TopCardRecord> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '群名称', dataIndex: 'room_name', key: 'room_name', width: 180, ellipsis: true },
  { title: '群ID', dataIndex: 'room_wxid', key: 'room_wxid', width: 220, ellipsis: true },
  { title: 'Alan', dataIndex: 'alan_name', key: 'alan_name', width: 120, ellipsis: true },
  { title: '注册人', dataIndex: 'register_name', key: 'register_name', width: 120, ellipsis: true },
  { title: '被赠与人', dataIndex: 'give_name', key: 'give_name', width: 120, ellipsis: true },
  { title: '置顶类型', dataIndex: 'top_type', key: 'top_type', width: 110 },
  { title: '剩余次数', dataIndex: 'remind_num', key: 'remind_num', width: 100 },
  { title: '更新时间', dataIndex: 'update_time', key: 'update_time', width: 180 },
  { title: '过期时间', dataIndex: 'expire_time', key: 'expire_time', width: 180 },
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

const currentUsername = computed(() => {
  const account = userStore.userInfo?.username || userStore.userInfo?.email || '';
  return String(account).trim();
});

const roomOptions = computed(() =>
  boundRooms.value.map((item) => ({
    label: item.roomName ? `${item.roomName} (${item.roomWxid})` : item.roomWxid,
    value: item.roomWxid,
  })),
);

function hasCode(code: string) {
  const roles = userStore.userInfo?.roles || [];
  if (roles.includes('super')) {
    return true;
  }
  return accessStore.accessCodes.includes(code);
}

const canEditTop = computed(() => hasCode('MX_USER_TOP_EDIT'));

const formModalOpen = ref(false);
const formSaving = ref(false);
const editingRecord = ref<TopCardRecord | null>(null);

const formState = reactive({
  alan_wxid: '',
  expire_time: '',
  give_wxid: '',
  register_wxid: '',
  remind_num: 1,
  room_name: '',
  room_wxid: '',
  top_type: '月置顶',
  update_time: '',
});

function asRow(record: Record<string, any>) {
  return record as TopCardRecord;
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
      roomName: String(item.roomName || '').trim(),
      roomWxid,
    });
  }
  return [...roomMap.values()];
}

function findBoundRoom(roomWxid: string) {
  return boundRooms.value.find((item) => item.roomWxid === roomWxid) || null;
}

function syncFormRoomInfo(roomWxid: string) {
  formState.room_wxid = roomWxid;
  const room = findBoundRoom(roomWxid);
  formState.room_name = room?.roomName || roomWxid;
}

function buildQueryParams(
  page = paginationCurrent.value,
  pageSize = paginationPageSize.value,
): TopCardQueryParams {
  const hasRange = !!(queryState.timeRange && queryState.timeRange.length === 2);

  return {
    end: hasRange ? toDateText(queryState.timeRange?.[1]?.endOf('day')) : undefined,
    keywordFields: queryState.keywordFields,
    keywords: splitKeywords(queryState.keywordsText),
    page,
    pageSize,
    roomWxid: queryState.roomWxid.trim(),
    start: hasRange ? toDateText(queryState.timeRange?.[0]?.startOf('day')) : undefined,
    topType: queryState.topType || undefined,
  };
}

async function loadData(page = paginationCurrent.value, pageSize = paginationPageSize.value) {
  if (!queryState.roomWxid.trim()) {
    rows.value = [];
    total.value = 0;
    return;
  }

  loading.value = true;
  try {
    const result = await queryTopCards(buildQueryParams(page, pageSize));
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
    message.error(error instanceof Error ? error.message : '加载绑定群失败');
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

function handleTableChange(pagination: TablePaginationConfig) {
  loadData(pagination.current ?? 1, pagination.pageSize ?? 20);
}

function resetFilters() {
  queryState.keywordsText = '';
  queryState.topType = '';
  queryState.timeRange = undefined;
}

async function onExport() {
  if (!queryState.roomWxid.trim()) {
    message.warning('请先选择群聊');
    return;
  }

  try {
    const { blob, filename } = await exportTopCardsExcel(buildQueryParams(1, 5000));
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
  if (!canEditTop.value) {
    message.warning('当前账号无编辑置顶卡权限');
    return;
  }
  if (!queryState.roomWxid) {
    message.warning('请先选择群聊');
    return;
  }

  editingRecord.value = null;
  syncFormRoomInfo(queryState.roomWxid);
  formState.alan_wxid = '';
  formState.register_wxid = '';
  formState.give_wxid = '';
  formState.top_type = queryState.topType || '月置顶';
  formState.remind_num = 1;
  formState.update_time = '';
  formState.expire_time = '';
  formModalOpen.value = true;
}

function openEditModal(row: TopCardRecord) {
  if (!canEditTop.value) {
    message.warning('当前账号无编辑置顶卡权限');
    return;
  }
  editingRecord.value = row;
  formState.room_wxid = row.room_wxid;
  formState.room_name = row.room_name;
  formState.alan_wxid = row.alan_wxid;
  formState.register_wxid = row.register_wxid;
  formState.give_wxid = row.give_wxid;
  formState.top_type = row.top_type;
  formState.remind_num = row.remind_num;
  formState.update_time = row.update_time;
  formState.expire_time = row.expire_time;
  formModalOpen.value = true;
}

async function submitForm() {
  if (!canEditTop.value) {
    message.warning('当前账号无编辑置顶卡权限');
    return;
  }
  if (!formState.room_wxid.trim() || !formState.room_name.trim()) {
    message.warning('群ID和群名称不能为空');
    return;
  }
  if (!formState.alan_wxid.trim() || !formState.register_wxid.trim() || !formState.give_wxid.trim()) {
    message.warning('Alan、注册人、被赠与人不能为空');
    return;
  }

  formSaving.value = true;
  try {
    const result = await saveTopCard({
      alan_wxid: formState.alan_wxid.trim(),
      expire_time: formState.expire_time || undefined,
      give_wxid: formState.give_wxid.trim(),
      id: editingRecord.value?.id,
      register_wxid: formState.register_wxid.trim(),
      remind_num: Number(formState.remind_num || 0),
      room_name: formState.room_name.trim(),
      room_wxid: formState.room_wxid.trim(),
      top_type: formState.top_type.trim(),
      update_time: formState.update_time || undefined,
    });

    await appendOperationLog(
      '麦序机器人-用户/置顶卡设置',
      editingRecord.value ? '修改置顶卡' : '新增置顶卡',
      {
        room_wxid: formState.room_wxid,
        top_type: formState.top_type,
        give_wxid: formState.give_wxid,
      },
    );

    message.success(result.msg);
    formModalOpen.value = false;
    await loadData(1, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    formSaving.value = false;
  }
}

async function onDelete(row: TopCardRecord) {
  if (!canEditTop.value) {
    message.warning('当前账号无编辑置顶卡权限');
    return;
  }
  try {
    const msg = await deleteTopCardById(row.id);
    await appendOperationLog('麦序机器人-用户/置顶卡设置', '删除置顶卡', {
      id: row.id,
      room_wxid: row.room_wxid,
      top_type: row.top_type,
    });
    message.success(msg);
    await loadData(paginationCurrent.value, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
  }
}

loadBoundRooms();
</script>

<template>
  <Page title="置顶卡设置" description="自动加载已绑定群聊，支持筛选、增删改查、导出。">
    <Card class="mb-4">
      <div class="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-5 md:grid-cols-2">
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
        <Select v-model:value="queryState.topType" :options="topTypeOptions" placeholder="置顶类型" />
        <RangePicker v-model:value="queryState.timeRange" format="YYYY-MM-DD" style="width: 100%" />
        <Select v-model:value="queryState.keywordFields" :options="keywordFieldOptions" mode="multiple" :max-tag-count="2" placeholder="关键字字段" />
        <Input v-model:value="queryState.keywordsText" placeholder="多个关键字(空格/逗号分隔)" />
      </div>

      <Space>
        <Button type="primary" @click="loadData(1, paginationPageSize)">查询</Button>
        <Button @click="resetFilters">重置筛选</Button>
        <Button @click="onExport">导出Excel</Button>
        <Button type="dashed" :disabled="!canEditTop" @click="openCreateModal">新增</Button>
      </Space>
    </Card>

    <Card>
      <Table :columns="columns" :data-source="rows" :loading="loading" :pagination="tablePagination" :scroll="{ x: 1700 }" row-key="id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'top_type'">
            <Tag color="purple">{{ asRow(record).top_type }}</Tag>
          </template>
          <template v-else-if="column.key === 'actions'">
            <Space>
              <Button size="small" type="link" :disabled="!canEditTop" @click="openEditModal(asRow(record))">修改</Button>
              <Popconfirm title="确认删除这条置顶卡记录吗？" @confirm="onDelete(asRow(record))">
                <Button size="small" danger type="link" :disabled="!canEditTop">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal v-model:open="formModalOpen" :confirm-loading="formSaving" :ok-button-props="{ disabled: !canEditTop }" :title="editingRecord ? '修改置顶卡' : '新增置顶卡'" width="760px" @ok="submitForm">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          v-model:value="formState.room_wxid"
          :options="roomOptions"
          placeholder="群ID"
          show-search
          :filter-option="(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())"
          @change="(value) => syncFormRoomInfo(String(value || ''))"
        />
        <Input v-model:value="formState.room_name" placeholder="群名称" />
        <Input v-model:value="formState.alan_wxid" placeholder="Alan WXID" />
        <Input v-model:value="formState.register_wxid" placeholder="注册人 WXID" />
        <Input v-model:value="formState.give_wxid" placeholder="被赠与人 WXID" />
        <Input v-model:value="formState.top_type" placeholder="置顶类型" />
        <InputNumber v-model:value="formState.remind_num" :min="0" :precision="0" style="width: 100%" placeholder="剩余次数" />
        <Input v-model:value="formState.update_time" placeholder="更新时间(可选) YYYY-MM-DD HH:mm:ss" />
        <Input v-model:value="formState.expire_time" class="md:col-span-2" placeholder="过期时间(可选) YYYY-MM-DD HH:mm:ss" />
      </div>
    </Modal>
  </Page>
</template>
