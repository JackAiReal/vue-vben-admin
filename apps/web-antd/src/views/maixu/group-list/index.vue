<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Dropdown,
  Input,
  InputNumber,
  Menu,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import {
  deleteWxRoomMember,
  queryWxRoomMembers,
  saveWxRoomMember,
  type WxRoomMember,
} from '#/api/maixu/member';
import {
  fetchMaixuRooms,
  type MaixuRoomItem,
  updateMaixuRoomConfig,
  updateMaixuRoomConfigItem,
} from '#/api/maixu/room';

const accessStore = useAccessStore();
const userStore = useUserStore();

const loading = ref(false);
const rooms = ref<MaixuRoomItem[]>([]);

const keyword = ref('');
const paginationCurrent = ref(1);
const paginationPageSize = ref(10);

const configModalOpen = ref(false);
const configSaving = ref(false);
const configText = ref('');

const delayModalOpen = ref(false);
const delaySaving = ref(false);
const delayDays = ref(1);

const selectedRoom = ref<MaixuRoomItem | null>(null);

const memberModalOpen = ref(false);
const memberLoading = ref(false);
const memberKeyword = ref('');
const memberRows = ref<WxRoomMember[]>([]);
const memberTotal = ref(0);
const memberPaginationCurrent = ref(1);
const memberPaginationPageSize = ref(10);

const memberFormModalOpen = ref(false);
const memberFormSaving = ref(false);
const editingMember = ref<WxRoomMember | null>(null);
const memberForm = ref({
  account: '',
  city: '',
  country: '',
  display_name: '',
  nickname: '',
  province: '',
  remark: '',
  sex: 0,
  wxid: '',
});

function hasCode(code: string) {
  const roles = userStore.userInfo?.roles || [];
  if (roles.includes('super')) {
    return true;
  }
  return accessStore.accessCodes.includes(code);
}

const canEditRoom = computed(() => hasCode('MX_ROOM_EDIT'));
const canViewMembers = computed(() => hasCode('MX_MEMBER_VIEW'));
const canEditMembers = computed(() => hasCode('MX_MEMBER_EDIT'));

function parseDateString(value: string) {
  const timestamp = Date.parse(value.replace(' ', 'T'));
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function formatDateTime(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  const ss = `${date.getSeconds()}`.padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function sortRoomsByTime() {
  rooms.value = [...rooms.value].sort((left, right) => {
    const leftTime = parseDateString(left.update_time)?.getTime() ?? 0;
    const rightTime = parseDateString(right.update_time)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

function upsertRoom(item: MaixuRoomItem) {
  const index = rooms.value.findIndex((room) => room.room_wxid === item.room_wxid);
  if (index === -1) {
    rooms.value.unshift(item);
  } else {
    const current = rooms.value[index];
    if (!current) {
      return;
    }
    rooms.value[index] = {
      ...current,
      ...item,
      room_config: item.room_config ?? current.room_config,
    };
  }
  sortRoomsByTime();
}

function asRoom(record: Record<string, any>) {
  return record as MaixuRoomItem;
}

function asMember(record: Record<string, any>) {
  return record as WxRoomMember;
}

function getRoomConfig(record: MaixuRoomItem) {
  return record.room_config ?? {};
}

function isRoomStarted(record: MaixuRoomItem) {
  const value = getRoomConfig(record).isStart;
  if (typeof value === 'boolean') {
    return value;
  }
  return true;
}

function roomConfigSummary(record: MaixuRoomItem) {
  const config = getRoomConfig(record);
  const expireTime = typeof config.expireTime === 'string' ? config.expireTime : '未设置';
  const adminCount = Array.isArray(config.adminWxids) ? config.adminWxids.length : 0;
  return `到期: ${expireTime} | 管理员: ${adminCount}`;
}

const columns: TableColumnsType<MaixuRoomItem> = [
  {
    title: '群名称',
    dataIndex: 'room_name',
    key: 'room_name',
    width: 220,
    ellipsis: true,
  },
  {
    title: '群 WXID',
    dataIndex: 'room_wxid',
    key: 'room_wxid',
    width: 260,
    ellipsis: true,
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
  },
  {
    title: '配置摘要',
    key: 'configSummary',
    width: 320,
  },
  {
    title: '更新时间',
    dataIndex: 'update_time',
    key: 'update_time',
    width: 190,
    sorter: (left, right) => {
      const leftTime = parseDateString(left.update_time)?.getTime() ?? 0;
      const rightTime = parseDateString(right.update_time)?.getTime() ?? 0;
      return leftTime - rightTime;
    },
    defaultSortOrder: 'descend',
  },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 160,
  },
];

const memberColumns: TableColumnsType<WxRoomMember> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 130, ellipsis: true },
  { title: '群昵称', dataIndex: 'display_name', key: 'display_name', width: 130, ellipsis: true },
  { title: 'WXID', dataIndex: 'wxid', key: 'wxid', width: 220, ellipsis: true },
  { title: '账号', dataIndex: 'account', key: 'account', width: 120, ellipsis: true },
  { title: '备注', dataIndex: 'remark', key: 'remark', width: 140, ellipsis: true },
  { title: '更新时间', dataIndex: 'update_time', key: 'update_time', width: 170 },
  { title: '操作', key: 'actions', width: 120, fixed: 'right' },
];

const filteredRooms = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  if (!text) {
    return rooms.value;
  }

  return rooms.value.filter((room) => {
    return (
      room.room_name.toLowerCase().includes(text) ||
      room.room_wxid.toLowerCase().includes(text)
    );
  });
});

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: paginationCurrent.value,
  pageSize: paginationPageSize.value,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
  total: filteredRooms.value.length,
}));

const memberPagination = computed<TablePaginationConfig>(() => ({
  current: memberPaginationCurrent.value,
  pageSize: memberPaginationPageSize.value,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`,
  total: memberTotal.value,
}));

const configValidationMessage = computed(() => {
  if (!configText.value.trim()) {
    return '配置不能为空';
  }

  try {
    const parsed = JSON.parse(configText.value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return '配置必须是 JSON 对象';
    }
    return '';
  } catch {
    return 'JSON 格式不正确';
  }
});

async function loadRooms() {
  loading.value = true;
  try {
    rooms.value = await fetchMaixuRooms();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '加载群列表失败';
    message.error(errorMessage);
  } finally {
    loading.value = false;
  }
}

function openConfigModal(record: MaixuRoomItem) {
  selectedRoom.value = record;
  configText.value = JSON.stringify(getRoomConfig(record), null, 2);
  configModalOpen.value = true;
}

async function saveConfig() {
  if (!canEditRoom.value) {
    message.warning('当前账号无修改群配置权限');
    return;
  }
  if (!selectedRoom.value) {
    return;
  }
  if (configValidationMessage.value) {
    message.warning(configValidationMessage.value);
    return;
  }

  const parsedConfig = JSON.parse(configText.value);
  configSaving.value = true;
  try {
    const updated = await updateMaixuRoomConfig({
      room_config: parsedConfig,
      room_name: selectedRoom.value.room_name,
      room_wxid: selectedRoom.value.room_wxid,
    });
    upsertRoom({
      ...selectedRoom.value,
      ...updated,
      room_config: parsedConfig,
      update_time: updated.update_time || formatDateTime(new Date()),
    });
    configModalOpen.value = false;
    message.success('配置已保存');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '保存配置失败';
    message.error(errorMessage);
  } finally {
    configSaving.value = false;
  }
}

function openDelayModal(record: MaixuRoomItem) {
  selectedRoom.value = record;
  delayDays.value = 1;
  delayModalOpen.value = true;
}

async function extendRoomExpireTime() {
  if (!canEditRoom.value) {
    message.warning('当前账号无修改群配置权限');
    return;
  }
  if (!selectedRoom.value) {
    return;
  }

  const room = selectedRoom.value;
  const config = { ...getRoomConfig(room) };
  const expireKeyCandidates = ['expireTime', 'expire_time', 'expireAt', 'expire_at'];
  const expireKey =
    expireKeyCandidates.find((key) => typeof config[key] === 'string') ?? 'expireTime';

  const currentDate =
    parseDateString(String(config[expireKey] ?? '')) ??
    parseDateString(room.update_time) ??
    new Date();

  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + Number(delayDays.value || 0));
  config[expireKey] = formatDateTime(nextDate);

  delaySaving.value = true;
  try {
    const updated = await updateMaixuRoomConfig({
      room_config: config,
      room_name: room.room_name,
      room_wxid: room.room_wxid,
    });
    upsertRoom({
      ...room,
      ...updated,
      room_config: config,
      update_time: updated.update_time || formatDateTime(new Date()),
    });
    delayModalOpen.value = false;
    message.success(`已延长 ${delayDays.value} 天`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '延长时间失败';
    message.error(errorMessage);
  } finally {
    delaySaving.value = false;
  }
}

async function setRoomRunning(record: MaixuRoomItem, running: boolean) {
  if (!canEditRoom.value) {
    message.warning('当前账号无修改群配置权限');
    return;
  }
  try {
    const updated = await updateMaixuRoomConfigItem(record.room_wxid, 'isStart', running);
    const config = {
      ...getRoomConfig(record),
      ...(updated.room_config ?? {}),
      isStart: running,
    };

    upsertRoom({
      ...record,
      ...updated,
      room_config: config,
      update_time: updated.update_time || formatDateTime(new Date()),
    });

    message.success(running ? '群聊已恢复' : '群聊已暂停');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '操作失败';
    message.error(errorMessage);
  }
}

async function loadMembers(page = memberPaginationCurrent.value, pageSize = memberPaginationPageSize.value) {
  if (!selectedRoom.value) {
    return;
  }

  memberLoading.value = true;
  try {
    const result = await queryWxRoomMembers({
      keyword: memberKeyword.value.trim(),
      page,
      pageSize,
      roomWxid: selectedRoom.value.room_wxid,
    });
    memberRows.value = result.list;
    memberTotal.value = result.total;
    memberPaginationCurrent.value = result.page;
    memberPaginationPageSize.value = result.pageSize;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '加载成员失败';
    message.error(errorMessage);
  } finally {
    memberLoading.value = false;
  }
}

function openMembersModal(record: MaixuRoomItem) {
  if (!canViewMembers.value) {
    message.warning('当前账号无查看群成员权限');
    return;
  }
  selectedRoom.value = record;
  memberKeyword.value = '';
  memberPaginationCurrent.value = 1;
  memberModalOpen.value = true;
  loadMembers(1, memberPaginationPageSize.value);
}

function openMemberCreateModal() {
  if (!canEditMembers.value) {
    message.warning('当前账号无编辑群成员权限');
    return;
  }
  if (!selectedRoom.value) {
    return;
  }
  editingMember.value = null;
  memberForm.value = {
    account: '',
    city: '',
    country: '',
    display_name: '',
    nickname: '',
    province: '',
    remark: '',
    sex: 0,
    wxid: '',
  };
  memberFormModalOpen.value = true;
}

function openMemberEditModal(record: WxRoomMember) {
  if (!canEditMembers.value) {
    message.warning('当前账号无编辑群成员权限');
    return;
  }
  editingMember.value = record;
  memberForm.value = {
    account: record.account || '',
    city: record.city || '',
    country: record.country || '',
    display_name: record.display_name || '',
    nickname: record.nickname || '',
    province: record.province || '',
    remark: record.remark || '',
    sex: record.sex ?? 0,
    wxid: record.wxid || '',
  };
  memberFormModalOpen.value = true;
}

async function saveMember() {
  if (!canEditMembers.value) {
    message.warning('当前账号无编辑群成员权限');
    return;
  }
  if (!selectedRoom.value) {
    return;
  }
  if (!memberForm.value.wxid.trim()) {
    message.warning('成员 WXID 不能为空');
    return;
  }

  memberFormSaving.value = true;
  try {
    const result = await saveWxRoomMember({
      ...memberForm.value,
      id: editingMember.value?.id,
      room_wxid: selectedRoom.value.room_wxid,
      wxid: memberForm.value.wxid.trim(),
    });
    message.success(result.msg);
    memberFormModalOpen.value = false;
    await loadMembers(memberPaginationCurrent.value, memberPaginationPageSize.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '保存成员失败';
    message.error(errorMessage);
  } finally {
    memberFormSaving.value = false;
  }
}

async function removeMember(record: WxRoomMember) {
  if (!canEditMembers.value) {
    message.warning('当前账号无编辑群成员权限');
    return;
  }
  try {
    const msg = await deleteWxRoomMember(record.id);
    message.success(msg);
    await loadMembers(memberPaginationCurrent.value, memberPaginationPageSize.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '删除成员失败';
    message.error(errorMessage);
  }
}

function handleAction(action: string, record: MaixuRoomItem) {
  if (action === 'config') {
    openConfigModal(record);
    return;
  }

  if (action === 'delay') {
    openDelayModal(record);
    return;
  }

  if (action === 'members') {
    openMembersModal(record);
    return;
  }

  if (action === 'pause') {
    setRoomRunning(record, false);
    return;
  }

  if (action === 'resume') {
    setRoomRunning(record, true);
  }
}

function handleTableChange(pagination: TablePaginationConfig) {
  paginationCurrent.value = pagination.current ?? 1;
  paginationPageSize.value = pagination.pageSize ?? 10;
}

function handleMemberTableChange(pagination: TablePaginationConfig) {
  const nextPage = pagination.current ?? 1;
  const nextSize = pagination.pageSize ?? 10;
  loadMembers(nextPage, nextSize);
}

loadRooms();
</script>

<template>
  <Page
    description="分页展示群配置，支持配置编辑、延长到期时间、暂停/恢复。"
    title="麦序群列表"
  >
    <Card>
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <Input
          v-model:value="keyword"
          allow-clear
          placeholder="搜索群名称或群 WXID"
          style="width: 260px"
        />
        <Button :loading="loading" type="primary" @click="loadRooms">刷新</Button>
      </div>

      <Table
        :columns="columns"
        :data-source="filteredRooms"
        :loading="loading"
        :pagination="tablePagination"
        :scroll="{ x: 1200 }"
        row-key="room_wxid"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="isRoomStarted(asRoom(record)) ? 'green' : 'red'">
              {{ isRoomStarted(asRoom(record)) ? '运行中' : '已暂停' }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'configSummary'">
            <span>{{ roomConfigSummary(asRoom(record)) }}</span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <Dropdown>
              <Button type="link">操作</Button>
              <template #overlay>
                <Menu @click="({ key }) => handleAction(String(key), asRoom(record))">
                  <Menu.Item key="config" :disabled="!canEditRoom">配置</Menu.Item>
                  <Menu.Item key="members" :disabled="!canViewMembers">加载群成员</Menu.Item>
                  <Menu.Item key="delay" :disabled="!canEditRoom">延长时间</Menu.Item>
                  <Menu.Item v-if="isRoomStarted(asRoom(record))" key="pause" :disabled="!canEditRoom">暂停</Menu.Item>
                  <Menu.Item v-else key="resume" :disabled="!canEditRoom">恢复</Menu.Item>
                </Menu>
              </template>
            </Dropdown>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="configModalOpen"
      :confirm-loading="configSaving"
      :ok-button-props="{ disabled: !!configValidationMessage }"
      title="编辑群配置 JSON"
      width="820px"
      @ok="saveConfig"
    >
      <p class="mb-2 text-red-500" v-if="configValidationMessage">
        {{ configValidationMessage }}
      </p>
      <Input.TextArea
        v-model:value="configText"
        :auto-size="{ minRows: 14, maxRows: 20 }"
        placeholder="请输入合法 JSON"
      />
    </Modal>

    <Modal
      v-model:open="delayModalOpen"
      :confirm-loading="delaySaving"
      title="延长群配置时间"
      width="420px"
      @ok="extendRoomExpireTime"
    >
      <Space direction="vertical" style="width: 100%">
        <div>选择要延长的天数</div>
        <InputNumber
          v-model:value="delayDays"
          :max="365"
          :min="1"
          :precision="0"
          style="width: 100%"
        />
      </Space>
    </Modal>

    <Modal
      v-model:open="memberModalOpen"
      :footer="null"
      :title="`群成员列表 - ${selectedRoom?.room_name || ''}`"
      width="1150px"
    >
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <Input
          v-model:value="memberKeyword"
          allow-clear
          placeholder="筛选: 昵称/WXID/账号/备注"
          style="width: 260px"
          @press-enter="() => loadMembers(1, memberPaginationPageSize)"
        />
        <Button type="primary" @click="loadMembers(1, memberPaginationPageSize)">查询</Button>
        <Button :disabled="!canEditMembers" @click="openMemberCreateModal">新增成员</Button>
      </div>

      <Table
        :columns="memberColumns"
        :data-source="memberRows"
        :loading="memberLoading"
        :pagination="memberPagination"
        :scroll="{ x: 1200 }"
        row-key="id"
        @change="handleMemberTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'actions'">
            <Space>
              <Button size="small" type="link" :disabled="!canEditMembers" @click="openMemberEditModal(asMember(record))">修改</Button>
              <Popconfirm title="确认删除该成员吗？" @confirm="removeMember(asMember(record))">
                <Button danger size="small" type="link" :disabled="!canEditMembers">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Modal>

    <Modal
      v-model:open="memberFormModalOpen"
      :confirm-loading="memberFormSaving"
      :title="editingMember ? '修改成员' : '新增成员'"
      width="700px"
      @ok="saveMember"
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input v-model:value="memberForm.wxid" placeholder="成员WXID*" />
        <Input v-model:value="memberForm.account" placeholder="账号" />
        <Input v-model:value="memberForm.nickname" placeholder="昵称" />
        <Input v-model:value="memberForm.display_name" placeholder="群昵称" />
        <Input v-model:value="memberForm.remark" placeholder="备注" />
        <InputNumber v-model:value="memberForm.sex" :min="0" :max="2" style="width: 100%" placeholder="性别(0/1/2)" />
        <Input v-model:value="memberForm.city" placeholder="城市" />
        <Input v-model:value="memberForm.province" placeholder="省份" />
        <Input v-model:value="memberForm.country" placeholder="国家" class="md:col-span-2" />
      </div>
    </Modal>
  </Page>
</template>
