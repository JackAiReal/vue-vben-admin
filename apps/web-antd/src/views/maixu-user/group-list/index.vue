<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { WxRoomMember } from '#/api/maixu/member';
import type { MaixuRoomItem } from '#/api/maixu/room';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Dropdown,
  Input,
  Menu,
  message,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { queryWxRoomMembers } from '#/api/maixu/member';
import { appendOperationLog } from '#/api/maixu/operation-log';
import {
  consumeUserRoomBindCode,
  deleteUserRoomBinding,
  fetchUserRoomBindings,
} from '#/api/maixu/user-room';
import {
  deleteMaixuRoom,
  fetchMaixuRoomsByIds,
  updateMaixuRoomConfigItem,
  updateMaixuRoomConfigRaw,
} from '#/api/maixu/room';

const userStore = useUserStore();

const loading = ref(false);
const bindLoading = ref(false);
const bindCode = ref('');
const rooms = ref<MaixuRoomItem[]>([]);

const keyword = ref('');
const paginationCurrent = ref(1);
const paginationPageSize = ref(10);

type ConfigFieldType =
  | 'boolean'
  | 'float'
  | 'int'
  | 'json'
  | 'string'
  | 'textarea';

interface ConfigFieldItem {
  boolValue: boolean;
  key: string;
  textValue: string;
  type: ConfigFieldType;
}

const configModalOpen = ref(false);
const configSaving = ref(false);
const configFields = ref<ConfigFieldItem[]>([]);
const selectedRoom = ref<MaixuRoomItem | null>(null);

const memberModalOpen = ref(false);
const memberLoading = ref(false);
const memberKeyword = ref('');
const memberRows = ref<WxRoomMember[]>([]);
const memberTotal = ref(0);
const memberPaginationCurrent = ref(1);
const memberPaginationPageSize = ref(10);

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

function sanitizeRoomRecord(record: MaixuRoomItem) {
  return {
    ...record,
    room_name: String(record.room_name ?? '').trim(),
    room_wxid: normalizeRoomKey(record.room_wxid),
    update_time: String(record.update_time ?? '').trim(),
  };
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

function sortRoomsByTime(items: MaixuRoomItem[]) {
  return items.toSorted((left, right) => {
    const leftTime = parseDateString(left.update_time)?.getTime() ?? 0;
    const rightTime = parseDateString(right.update_time)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

function upsertRoom(item: MaixuRoomItem) {
  const normalized = sanitizeRoomRecord(item);
  if (!normalized.room_wxid) {
    return;
  }

  const index = rooms.value.findIndex(
    (room) => normalizeRoomKey(room.room_wxid) === normalized.room_wxid,
  );

  if (index < 0) {
    rooms.value = normalizeRooms([normalized, ...rooms.value]);
  } else {
    const current = rooms.value[index];
    if (!current) {
      return;
    }
    rooms.value[index] = {
      ...current,
      ...normalized,
      room_config: normalized.room_config ?? current.room_config,
    };
    rooms.value = normalizeRooms(rooms.value);
  }

  rooms.value = sortRoomsByTime(rooms.value);

  if (
    selectedRoom.value &&
    normalizeRoomKey(selectedRoom.value.room_wxid) === normalized.room_wxid
  ) {
    selectedRoom.value =
      rooms.value.find((room) => room.room_wxid === normalized.room_wxid) || null;
  }
}

const expireKeyCandidates = [
  'expireTime',
  'expire_time',
  'expireAt',
  'expire_at',
];

function getRoomConfig(record: MaixuRoomItem) {
  return record.room_config ?? {};
}

function formatConfigLabel(key: string) {
  return key
    .replaceAll(/_/g, ' ')
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function buildConfigField(key: string, value: unknown): ConfigFieldItem {
  if (typeof value === 'boolean') {
    return {
      boolValue: value,
      key,
      textValue: '',
      type: 'boolean',
    };
  }

  if (typeof value === 'number') {
    return {
      boolValue: false,
      key,
      textValue: String(value),
      type: Number.isInteger(value) ? 'int' : 'float',
    };
  }

  if (typeof value === 'string') {
    const text = value;
    const isLongText = text.length > 60 || text.includes('\n');
    return {
      boolValue: false,
      key,
      textValue: text,
      type: isLongText ? 'textarea' : 'string',
    };
  }

  return {
    boolValue: false,
    key,
    textValue: JSON.stringify(value ?? null, null, 2),
    type: 'json',
  };
}

function resolveExpireText(record: MaixuRoomItem) {
  const config = getRoomConfig(record);
  const key =
    expireKeyCandidates.find((item) => {
      const value = config[item];
      return typeof value === 'string' && String(value).trim();
    }) || 'expireTime';

  return String(config[key] ?? '').trim() || '未设置';
}

function isRoomStarted(record: MaixuRoomItem) {
  const value = getRoomConfig(record).isStart;
  if (typeof value === 'boolean') {
    return value;
  }
  return true;
}

const columns: TableColumnsType<MaixuRoomItem> = [
  {
    title: '群昵称',
    dataIndex: 'room_name',
    key: 'room_name',
    width: 220,
    ellipsis: true,
  },
  {
    title: '群ID',
    dataIndex: 'room_wxid',
    key: 'room_wxid',
    width: 240,
    ellipsis: true,
  },
  {
    title: '过期时间',
    key: 'expireTime',
    width: 190,
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
  },
  {
    title: '更新时间',
    dataIndex: 'update_time',
    key: 'update_time',
    width: 180,
  },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 220,
  },
];

const memberColumns: TableColumnsType<WxRoomMember> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  {
    title: '昵称',
    dataIndex: 'nickname',
    key: 'nickname',
    width: 140,
    ellipsis: true,
  },
  {
    title: '群昵称',
    dataIndex: 'display_name',
    key: 'display_name',
    width: 140,
    ellipsis: true,
  },
  { title: 'WXID', dataIndex: 'wxid', key: 'wxid', width: 220, ellipsis: true },
  { title: '账号', dataIndex: 'account', key: 'account', width: 130, ellipsis: true },
  { title: '备注', dataIndex: 'remark', key: 'remark', width: 140, ellipsis: true },
  {
    title: '更新时间',
    dataIndex: 'update_time',
    key: 'update_time',
    width: 180,
  },
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

function getConfigFieldError(item: ConfigFieldItem) {
  if (item.type === 'int') {
    const text = item.textValue.trim();
    if (!/^-?\d+$/.test(text)) {
      return '必须是整数';
    }
  }

  if (item.type === 'float') {
    const text = item.textValue.trim();
    if (!/^-?\d+\.\d+$/.test(text)) {
      return '必须是小数（例如 0.50）';
    }
  }

  if (item.type === 'json') {
    const text = item.textValue.trim();
    if (!text) {
      return '不能为空';
    }
    try {
      JSON.parse(text);
    } catch {
      return 'JSON 格式不正确';
    }
  }

  return '';
}

const configValidationMessage = computed(() => {
  for (const item of configFields.value) {
    const error = getConfigFieldError(item);
    if (error) {
      return `${formatConfigLabel(item.key)}${error}`;
    }
  }
  return '';
});

const currentUsername = computed(() => {
  const account = userStore.userInfo?.username || userStore.userInfo?.email || '';
  return String(account).trim();
});

async function loadRooms() {
  const username = currentUsername.value;
  if (!username) {
    message.warning('未获取到当前账号，请重新登录后重试');
    rooms.value = [];
    return;
  }

  loading.value = true;
  try {
    const bindings = await fetchUserRoomBindings(username);
    const roomIds = bindings
      .map((item) => normalizeRoomKey(item.roomWxid))
      .filter(Boolean);

    if (roomIds.length === 0) {
      rooms.value = [];
      return;
    }

    const roomList = await fetchMaixuRoomsByIds(roomIds);
    const roomMap = new Map<string, MaixuRoomItem>();
    for (const room of roomList) {
      const key = normalizeRoomKey(room.room_wxid);
      if (key) {
        roomMap.set(key, sanitizeRoomRecord(room));
      }
    }

    const mergedRooms: MaixuRoomItem[] = [];
    for (const bind of bindings) {
      const roomWxid = normalizeRoomKey(bind.roomWxid);
      if (!roomWxid) {
        continue;
      }
      const matched = roomMap.get(roomWxid);
      if (matched) {
        mergedRooms.push(matched);
        continue;
      }

      mergedRooms.push({
        room_config: {},
        room_name: bind.roomName || roomWxid,
        room_wxid: roomWxid,
        status: 1,
        update_time: bind.updatedAt || formatDateTime(new Date()),
      });
    }

    rooms.value = sortRoomsByTime(normalizeRooms(mergedRooms));
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '加载群列表失败';
    message.error(errorMessage);
  } finally {
    loading.value = false;
  }
}

async function bindRoomByCode() {
  const username = currentUsername.value;
  if (!username) {
    message.warning('未获取到当前账号，请重新登录后重试');
    return;
  }

  const code = bindCode.value.trim();
  if (!/^\d{4,8}$/.test(code)) {
    message.warning('请输入4-8位数字验证码');
    return;
  }

  bindLoading.value = true;
  try {
    const result = await consumeUserRoomBindCode(code, username);
    bindCode.value = '';

    await appendOperationLog('麦序机器人-用户/群列表', '绑定群聊', {
      room_name: result.roomName,
      room_wxid: result.roomWxid,
    });

    message.success(`绑定成功：${result.roomName || result.roomWxid}`);
    await loadRooms();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '绑定失败';
    message.error(errorMessage);
  } finally {
    bindLoading.value = false;
  }
}

function openConfigModal(record: MaixuRoomItem) {
  selectedRoom.value = record;
  configFields.value = Object.entries(getRoomConfig(record)).map(([key, value]) =>
    buildConfigField(key, value),
  );
  configModalOpen.value = true;
}

function buildConfigRawJson() {
  const pieces: string[] = [];

  for (const item of configFields.value) {
    const keyPart = JSON.stringify(item.key);
    let valuePart = 'null';

    if (item.type === 'boolean') {
      valuePart = item.boolValue ? 'true' : 'false';
    } else if (item.type === 'int') {
      valuePart = String(Number.parseInt(item.textValue.trim(), 10));
    } else if (item.type === 'float') {
      valuePart = item.textValue.trim();
    } else if (item.type === 'json') {
      valuePart = item.textValue.trim();
    } else {
      valuePart = JSON.stringify(item.textValue);
    }

    pieces.push(`${keyPart}:${valuePart}`);
  }

  return `{${pieces.join(',')}}`;
}

function buildConfigPayloadFromRaw(rawJson: string) {
  const parsed = JSON.parse(rawJson);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, any>)
    : {};
}

async function saveConfig() {
  if (!selectedRoom.value) {
    return;
  }
  if (configValidationMessage.value) {
    message.warning(configValidationMessage.value);
    return;
  }

  const configRawJson = buildConfigRawJson();
  const payload = buildConfigPayloadFromRaw(configRawJson);
  configSaving.value = true;
  try {
    const updated = await updateMaixuRoomConfigRaw({
      room_config_raw: configRawJson,
      room_name: selectedRoom.value.room_name,
      room_wxid: selectedRoom.value.room_wxid,
    });

    upsertRoom({
      ...selectedRoom.value,
      ...updated,
      room_config: payload,
      update_time: updated.update_time || formatDateTime(new Date()),
    });

    await appendOperationLog('麦序机器人-用户/群列表', '更新群配置', {
      room_name: selectedRoom.value.room_name,
      room_wxid: selectedRoom.value.room_wxid,
    });

    configModalOpen.value = false;
    message.success('配置已保存');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '保存配置失败';
    message.error(errorMessage);
  } finally {
    configSaving.value = false;
  }
}

async function setRoomRunning(record: MaixuRoomItem, running: boolean) {
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

    await appendOperationLog(
      '麦序机器人-用户/群列表',
      running ? '恢复群聊' : '暂停群聊',
      {
        room_name: record.room_name,
        room_wxid: record.room_wxid,
      },
    );

    message.success(running ? '群聊已恢复' : '群聊已暂停');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '操作失败';
    message.error(errorMessage);
  }
}

async function removeRoom(record: MaixuRoomItem) {
  const username = currentUsername.value;
  if (!username) {
    message.warning('未获取到当前账号，请重新登录后重试');
    return;
  }

  try {
    const deleteMessage = await deleteMaixuRoom(record.room_wxid);

    await Promise.allSettled([
      deleteUserRoomBinding(record.room_wxid, username),
      appendOperationLog('麦序机器人-用户/群列表', '删除群聊', {
        room_name: record.room_name,
        room_wxid: record.room_wxid,
      }),
    ]);

    rooms.value = rooms.value.filter(
      (room) => normalizeRoomKey(room.room_wxid) !== normalizeRoomKey(record.room_wxid),
    );

    message.success(deleteMessage || '群聊已删除');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '删除失败';
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
      error instanceof Error ? error.message : '加载群成员失败';
    message.error(errorMessage);
  } finally {
    memberLoading.value = false;
  }
}

function openMembersModal(record: MaixuRoomItem) {
  selectedRoom.value = record;
  memberKeyword.value = '';
  memberPaginationCurrent.value = 1;
  memberModalOpen.value = true;
  loadMembers(1, memberPaginationPageSize.value);
}

function handleConfigAction(action: string, record: MaixuRoomItem) {
  if (action === 'members') {
    openMembersModal(record);
    return;
  }

  if (action === 'config-all') {
    openConfigModal(record);
  }
}

function asRoom(record: Record<string, any>) {
  return record as MaixuRoomItem;
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
    description="先在群里@机器人触发验证码，再用验证码绑定，只加载你已绑定的群聊。"
    title="麦序机器人-用户 / 群列表"
  >
    <Card>
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <Input
          v-model:value="bindCode"
          allow-clear
          placeholder="输入机器人返回的10分钟数字验证码"
          style="width: 320px"
          @press-enter="bindRoomByCode"
        />
        <Button :loading="bindLoading" type="primary" @click="bindRoomByCode">
          绑定
        </Button>
        <Input
          v-model:value="keyword"
          allow-clear
          placeholder="搜索群昵称或群ID"
          style="width: 260px"
        />
        <Button :loading="loading" @click="loadRooms">刷新</Button>
      </div>

      <Table
        :columns="columns"
        :data-source="filteredRooms"
        :loading="loading"
        :pagination="tablePagination"
        :scroll="{ x: 1160 }"
        row-key="room_wxid"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'expireTime'">
            {{ resolveExpireText(asRoom(record)) }}
          </template>

          <template v-else-if="column.key === 'status'">
            <Tag :color="isRoomStarted(asRoom(record)) ? 'green' : 'red'">
              {{ isRoomStarted(asRoom(record)) ? '运行中' : '已暂停' }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <Space size="small">
              <Dropdown :trigger="['hover']">
                <Button type="link">配置</Button>
                <template #overlay>
                  <Menu
                    @click="({ key }) => handleConfigAction(String(key), asRoom(record))"
                  >
                    <Menu.Item key="members">群成员</Menu.Item>
                    <Menu.Item key="config-all">全部配置</Menu.Item>
                  </Menu>
                </template>
              </Dropdown>

              <Button
                v-if="isRoomStarted(asRoom(record))"
                type="link"
                @click="setRoomRunning(asRoom(record), false)"
              >
                暂停
              </Button>
              <Button
                v-else
                type="link"
                @click="setRoomRunning(asRoom(record), true)"
              >
                恢复
              </Button>

              <Popconfirm
                title="确认删除该群吗？删除后会解除当前账号的绑定关系。"
                @confirm="removeRoom(asRoom(record))"
              >
                <Button danger type="link">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="configModalOpen"
      :confirm-loading="configSaving"
      :ok-button-props="{ disabled: !!configValidationMessage }"
      title="全部配置"
      width="860px"
      @ok="saveConfig"
    >
      <p
        v-if="configValidationMessage"
        class="mb-2"
        style="color: var(--ant-color-error)"
      >
        {{ configValidationMessage }}
      </p>
      <div v-if="configFields.length === 0" class="opacity-70">暂无可配置项</div>
      <div v-else class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        <div
          v-for="item in configFields"
          :key="item.key"
          :class="[
            'py-1',
            item.type === 'textarea' || item.type === 'json'
              ? 'space-y-2'
              : 'flex items-center gap-3',
          ]"
        >
          <div class="min-w-[180px] text-sm font-medium">
            {{ formatConfigLabel(item.key) }}
          </div>

          <div class="flex-1">
            <Switch
              v-if="item.type === 'boolean'"
              v-model:checked="item.boolValue"
              checked-children="开"
              un-checked-children="关"
            />

            <Input
              v-else-if="item.type === 'string' || item.type === 'int' || item.type === 'float'"
              v-model:value="item.textValue"
              :placeholder="
                item.type === 'int'
                  ? '请输入整数'
                  : item.type === 'float'
                    ? '请输入小数'
                    : '请输入内容'
              "
              :status="getConfigFieldError(item) ? 'error' : ''"
            />

            <Input.TextArea
              v-else
              v-model:value="item.textValue"
              :auto-size="{ minRows: item.type === 'textarea' ? 2 : 4, maxRows: 10 }"
              :placeholder="item.type === 'json' ? '请输入合法 JSON' : '请输入内容'"
              :status="getConfigFieldError(item) ? 'error' : ''"
            />

            <div
              v-if="getConfigFieldError(item)"
              class="mt-1 text-xs"
              style="color: var(--ant-color-error)"
            >
              {{ getConfigFieldError(item) }}
            </div>
          </div>
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="memberModalOpen"
      :footer="null"
      :title="`群成员列表 - ${selectedRoom?.room_name || ''}`"
      width="1100px"
    >
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <Input
          v-model:value="memberKeyword"
          allow-clear
          placeholder="筛选: 昵称/WXID/账号/备注"
          style="width: 260px"
          @press-enter="() => loadMembers(1, memberPaginationPageSize)"
        />
        <Button type="primary" @click="loadMembers(1, memberPaginationPageSize)">
          查询
        </Button>
      </div>

      <Table
        :columns="memberColumns"
        :data-source="memberRows"
        :loading="memberLoading"
        :pagination="memberPagination"
        :scroll="{ x: 1100 }"
        row-key="id"
        @change="handleMemberTableChange"
      />
    </Modal>
  </Page>
</template>
