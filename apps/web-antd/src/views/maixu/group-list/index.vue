<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { WxRoomMember } from '#/api/maixu/member';
import type { MaixuRoomItem } from '#/api/maixu/room';

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
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  deleteWxRoomMember,
  queryWxRoomMembers,
  saveWxRoomMember,
} from '#/api/maixu/member';
import { appendOperationLog } from '#/api/maixu/operation-log';
import {
  fetchMaixuRooms,
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
const manualExpireTime = ref('');

const transferModalOpen = ref(false);
const transferConfirmOpen = ref(false);
const transferSaving = ref(false);
const transferForm = ref({
  newRoomWxid: '',
  oldRoomWxid: '',
});
const transferPreview = ref<null | {
  days: number;
  newExpire: string;
  newRoom: MaixuRoomItem;
  oldRoom: MaixuRoomItem;
}>(null);

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
const editingMember = ref<null | WxRoomMember>(null);
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

function normalizeRoomKey(value: unknown) {
  if (typeof value === 'string') {
    return value.replaceAll(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replaceAll(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

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

const expireKeyCandidates = [
  'expireTime',
  'expire_time',
  'expireAt',
  'expire_at',
];

function parseDateTimeInput(value: string) {
  const text = value.trim();
  if (!text) {
    return null;
  }

  const matched = text.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!matched) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    matched;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hour, minute, second);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute ||
    parsed.getSeconds() !== second
  ) {
    return null;
  }

  return parsed;
}

function resolveExpireInfo(record: MaixuRoomItem) {
  const config = { ...getRoomConfig(record) };
  const key =
    expireKeyCandidates.find(
      (item) => typeof config[item] === 'string' && String(config[item]).trim(),
    ) || 'expireTime';

  const raw = String(config[key] ?? '').trim();
  const date = parseDateString(raw) ?? parseDateTimeInput(raw);

  return {
    config,
    date,
    key,
    raw,
  };
}

function sanitizeRoomRecord(record: MaixuRoomItem) {
  return {
    ...record,
    room_name: String(record.room_name ?? '').trim(),
    room_wxid: normalizeRoomKey(record.room_wxid),
    update_time: String(record.update_time ?? '').trim(),
  };
}

function sortRoomsByTime() {
  rooms.value = rooms.value.toSorted((left, right) => {
    const leftTime = parseDateString(left.update_time)?.getTime() ?? 0;
    const rightTime = parseDateString(right.update_time)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

function normalizeRooms(items: MaixuRoomItem[]) {
  const map = new Map<string, MaixuRoomItem>();
  for (const room of items) {
    const normalized = sanitizeRoomRecord(room);
    if (!normalized.room_wxid) {
      continue;
    }
    map.set(normalized.room_wxid, normalized);
  }
  return [...map.values()];
}

function upsertRoom(item: MaixuRoomItem) {
  const normalized = sanitizeRoomRecord(item);
  if (!normalized.room_wxid) {
    return null;
  }

  const index = rooms.value.findIndex(
    (room) => normalizeRoomKey(room.room_wxid) === normalized.room_wxid,
  );
  if (index === -1) {
    rooms.value.unshift(normalized);
  } else {
    const current = rooms.value[index];
    if (!current) {
      return null;
    }

    rooms.value[index] = {
      ...current,
      ...normalized,
      room_wxid: normalized.room_wxid,
      room_config: normalized.room_config ?? current.room_config,
    };
    normalized.room_config =
      rooms.value[index]?.room_config ?? normalized.room_config;
  }

  rooms.value = normalizeRooms(rooms.value);
  sortRoomsByTime();

  const merged =
    rooms.value.find((room) => room.room_wxid === normalized.room_wxid) || null;
  if (
    selectedRoom.value &&
    normalizeRoomKey(selectedRoom.value.room_wxid) === normalized.room_wxid
  ) {
    selectedRoom.value = merged;
  }
  return merged;
}

function findRoomByWxid(roomWxid: string) {
  const target = normalizeRoomKey(roomWxid);
  return (
    rooms.value.find((room) => normalizeRoomKey(room.room_wxid) === target) ||
    null
  );
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
  const expireInfo = resolveExpireInfo(record);
  const expireTime = expireInfo.raw || '未设置';
  const adminCount = Array.isArray(config.adminWxids)
    ? config.adminWxids.length
    : 0;
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
  {
    title: '昵称',
    dataIndex: 'nickname',
    key: 'nickname',
    width: 130,
    ellipsis: true,
  },
  {
    title: '群昵称',
    dataIndex: 'display_name',
    key: 'display_name',
    width: 130,
    ellipsis: true,
  },
  { title: 'WXID', dataIndex: 'wxid', key: 'wxid', width: 220, ellipsis: true },
  {
    title: '账号',
    dataIndex: 'account',
    key: 'account',
    width: 120,
    ellipsis: true,
  },
  {
    title: '备注',
    dataIndex: 'remark',
    key: 'remark',
    width: 140,
    ellipsis: true,
  },
  {
    title: '更新时间',
    dataIndex: 'update_time',
    key: 'update_time',
    width: 170,
  },
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
    const list = await fetchMaixuRooms();
    rooms.value = normalizeRooms(list);
    sortRoomsByTime();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '加载群列表失败';
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
    await appendOperationLog('麦序群列表', '保存群配置', {
      room_wxid: selectedRoom.value.room_wxid,
      room_name: selectedRoom.value.room_name,
    });
    message.success('配置已保存');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '保存配置失败';
    message.error(errorMessage);
  } finally {
    configSaving.value = false;
  }
}

function openDelayModal(record: MaixuRoomItem) {
  selectedRoom.value = record;
  delayDays.value = 1;
  manualExpireTime.value = '';
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
  const {
    config,
    date: resolvedDate,
    key: expireKey,
  } = resolveExpireInfo(room);

  let targetDate: Date | null = null;
  const customText = manualExpireTime.value.trim();
  if (customText) {
    targetDate = parseDateTimeInput(customText);
    if (!targetDate) {
      message.warning('过期时间格式不合法，请使用 YYYY-MM-DD HH:mm:ss');
      return;
    }
  } else {
    const baseDate =
      resolvedDate ?? parseDateString(room.update_time) ?? new Date();
    targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + Number(delayDays.value || 0));
  }

  config[expireKey] = formatDateTime(targetDate);

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
    await appendOperationLog(
      '麦序群列表',
      customText ? '设置群过期时间' : '延长群配置时间',
      {
        room_wxid: room.room_wxid,
        days: customText ? undefined : delayDays.value,
        expireTime: formatDateTime(targetDate),
      },
    );

    message.success(
      customText ? '过期时间设置成功' : `已延长 ${delayDays.value} 天`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '延长时间失败';
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
    const updated = await updateMaixuRoomConfigItem(
      record.room_wxid,
      'isStart',
      running,
      record,
    );
    const config = {
      ...getRoomConfig(record),
      ...updated.room_config,
      isStart: running,
    };

    upsertRoom({
      ...record,
      ...updated,
      room_config: config,
      update_time: updated.update_time || formatDateTime(new Date()),
    });

    await appendOperationLog('麦序群列表', running ? '恢复群聊' : '暂停群聊', {
      room_wxid: record.room_wxid,
      room_name: record.room_name,
    });
    message.success(running ? '群聊已恢复' : '群聊已暂停');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '操作失败';
    message.error(errorMessage);
  }
}

async function loadMembers(
  page = memberPaginationCurrent.value,
  pageSize = memberPaginationPageSize.value,
) {
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
    const errorMessage =
      error instanceof Error ? error.message : '加载成员失败';
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
    await appendOperationLog(
      '麦序群列表/成员管理',
      editingMember.value ? '修改成员' : '新增成员',
      {
        room_wxid: selectedRoom.value.room_wxid,
        wxid: memberForm.value.wxid,
        nickname: memberForm.value.nickname,
      },
    );
    message.success(result.msg);
    memberFormModalOpen.value = false;
    await loadMembers(
      memberPaginationCurrent.value,
      memberPaginationPageSize.value,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '保存成员失败';
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
    await appendOperationLog('麦序群列表/成员管理', '删除成员', {
      id: record.id,
      wxid: record.wxid,
      room_wxid: record.room_wxid,
    });
    message.success(msg);
    await loadMembers(
      memberPaginationCurrent.value,
      memberPaginationPageSize.value,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '删除成员失败';
    message.error(errorMessage);
  }
}

function openTransferModal() {
  if (!canEditRoom.value) {
    message.warning('当前账号无修改群配置权限');
    return;
  }
  transferForm.value = {
    newRoomWxid: '',
    oldRoomWxid: '',
  };
  transferPreview.value = null;
  transferConfirmOpen.value = false;
  transferModalOpen.value = true;
}

function calcTransferDays(expireDate: Date) {
  const now = new Date();
  const diffMs = expireDate.getTime() - now.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  const rawDays = diffMs / (24 * 3600 * 1000);
  return Math.max(1, Math.floor(rawDays));
}

async function prepareTransferPreview() {
  const oldRoomWxid = transferForm.value.oldRoomWxid.trim();
  const newRoomWxid = transferForm.value.newRoomWxid.trim();

  if (!oldRoomWxid || !newRoomWxid) {
    message.warning('旧群ID和新群ID不能为空');
    return;
  }
  if (oldRoomWxid === newRoomWxid) {
    message.warning('旧群ID和新群ID不能相同');
    return;
  }

  const oldRoom = findRoomByWxid(oldRoomWxid);
  const newRoom = findRoomByWxid(newRoomWxid);
  if (!oldRoom) {
    message.warning('旧群ID未找到');
    return;
  }
  if (!newRoom) {
    message.warning('新群ID未找到');
    return;
  }

  const oldExpireInfo = resolveExpireInfo(oldRoom);
  const newExpireInfo = resolveExpireInfo(newRoom);

  if (!oldExpireInfo.date) {
    message.warning('旧群未设置有效过期时间，无法转移');
    return;
  }

  const days = calcTransferDays(oldExpireInfo.date);
  if (days <= 0) {
    message.warning('旧群当前已过期，无法转移有效时间');
    return;
  }

  const newBase =
    newExpireInfo.date && newExpireInfo.date > new Date()
      ? newExpireInfo.date
      : new Date();
  const nextExpire = new Date(newBase);
  nextExpire.setDate(nextExpire.getDate() + days);

  transferPreview.value = {
    days,
    newExpire: formatDateTime(nextExpire),
    newRoom,
    oldRoom,
  };
  transferConfirmOpen.value = true;
}

async function confirmTransferExpireTime() {
  if (!transferPreview.value) {
    return;
  }
  if (!canEditRoom.value) {
    message.warning('当前账号无修改群配置权限');
    return;
  }

  const preview = transferPreview.value;
  const oldInfo = resolveExpireInfo(preview.oldRoom);
  const newInfo = resolveExpireInfo(preview.newRoom);

  const oldConfig = oldInfo.config;
  const newConfig = newInfo.config;

  oldConfig[oldInfo.key] = formatDateTime(new Date());
  newConfig[newInfo.key] = preview.newExpire;

  transferSaving.value = true;
  try {
    const [updatedOld, updatedNew] = await Promise.all([
      updateMaixuRoomConfig({
        room_config: oldConfig,
        room_name: preview.oldRoom.room_name,
        room_wxid: preview.oldRoom.room_wxid,
      }),
      updateMaixuRoomConfig({
        room_config: newConfig,
        room_name: preview.newRoom.room_name,
        room_wxid: preview.newRoom.room_wxid,
      }),
    ]);

    upsertRoom({
      ...preview.oldRoom,
      ...updatedOld,
      room_config: oldConfig,
      update_time: updatedOld.update_time || formatDateTime(new Date()),
    });
    upsertRoom({
      ...preview.newRoom,
      ...updatedNew,
      room_config: newConfig,
      update_time: updatedNew.update_time || formatDateTime(new Date()),
    });

    await appendOperationLog('麦序群列表', '过期时间转移', {
      days: preview.days,
      newRoomWxid: preview.newRoom.room_wxid,
      oldRoomWxid: preview.oldRoom.room_wxid,
      targetExpireTime: preview.newExpire,
    });

    transferConfirmOpen.value = false;
    transferModalOpen.value = false;
    transferPreview.value = null;
    message.success(`转移成功，已将 ${preview.days} 天有效期转移到新群`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '过期时间转移失败';
    message.error(errorMessage);
  } finally {
    transferSaving.value = false;
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
        <Button :loading="loading" type="primary" @click="loadRooms">
          刷新
        </Button>
        <Button :disabled="!canEditRoom" @click="openTransferModal">
          过期时间转移
        </Button>
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
                <Menu
                  @click="
                    ({ key }) => handleAction(String(key), asRoom(record))
                  "
                >
                  <Menu.Item key="config" :disabled="!canEditRoom">
                    配置
                  </Menu.Item>
                  <Menu.Item key="members" :disabled="!canViewMembers">
                    加载群成员
                  </Menu.Item>
                  <Menu.Item key="delay" :disabled="!canEditRoom">
                    延长时间
                  </Menu.Item>
                  <Menu.Item
                    v-if="isRoomStarted(asRoom(record))"
                    key="pause"
                    :disabled="!canEditRoom"
                  >
                    暂停
                  </Menu.Item>
                  <Menu.Item v-else key="resume" :disabled="!canEditRoom">
                    恢复
                  </Menu.Item>
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
      width="480px"
      @ok="extendRoomExpireTime"
    >
      <Space direction="vertical" style="width: 100%">
        <div>选择要延长的天数（不填过期时间时生效）</div>
        <InputNumber
          v-model:value="delayDays"
          :max="365"
          :min="1"
          :precision="0"
          style="width: 100%"
        />
        <div class="pt-2">或直接设置过期时间（YYYY-MM-DD HH:mm:ss）</div>
        <Input
          v-model:value="manualExpireTime"
          allow-clear
          placeholder="例如 2026-03-01 23:59:59"
        />
      </Space>
    </Modal>

    <Modal
      v-model:open="transferModalOpen"
      :confirm-loading="transferSaving"
      title="过期时间转移"
      width="520px"
      @ok="prepareTransferPreview"
    >
      <Space direction="vertical" style="width: 100%">
        <Input
          v-model:value="transferForm.oldRoomWxid"
          allow-clear
          placeholder="旧群ID"
        />
        <Input
          v-model:value="transferForm.newRoomWxid"
          allow-clear
          placeholder="新群ID"
        />
      </Space>
    </Modal>

    <Modal
      v-model:open="transferConfirmOpen"
      :confirm-loading="transferSaving"
      title="确认转移"
      width="560px"
      ok-text="确认转移"
      @ok="confirmTransferExpireTime"
    >
      <div v-if="transferPreview">
        确认要将 {{ transferPreview.oldRoom.room_name }}【{{
          transferPreview.oldRoom.room_wxid
        }}】 剩余的 {{ transferPreview.days }} 天，转移到
        {{ transferPreview.newRoom.room_name }}【{{
          transferPreview.newRoom.room_wxid
        }}】上吗？
        <div class="mt-2 text-xs text-gray-500">
          转移后新群过期时间：{{ transferPreview.newExpire }}
        </div>
      </div>
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
        <Button
          type="primary"
          @click="loadMembers(1, memberPaginationPageSize)"
        >
          查询
        </Button>
        <Button :disabled="!canEditMembers" @click="openMemberCreateModal">
          新增成员
        </Button>
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
              <Button
                size="small"
                type="link"
                :disabled="!canEditMembers"
                @click="openMemberEditModal(asMember(record))"
              >
                修改
              </Button>
              <Popconfirm
                title="确认删除该成员吗？"
                @confirm="removeMember(asMember(record))"
              >
                <Button
                  danger
                  size="small"
                  type="link"
                  :disabled="!canEditMembers"
                >
                  删除
                </Button>
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
        <InputNumber
          v-model:value="memberForm.sex"
          :min="0"
          :max="2"
          style="width: 100%"
          placeholder="性别(0/1/2)"
        />
        <Input v-model:value="memberForm.city" placeholder="城市" />
        <Input v-model:value="memberForm.province" placeholder="省份" />
        <Input
          v-model:value="memberForm.country"
          placeholder="国家"
          class="md:col-span-2"
        />
      </div>
    </Modal>
  </Page>
</template>
