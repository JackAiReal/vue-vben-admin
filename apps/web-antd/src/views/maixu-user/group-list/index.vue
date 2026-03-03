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
  queryUserRoomBindings,
} from '#/api/maixu/user-room';
import {
  deleteMaixuRoom,
  fetchMaixuRoomsByIds,
  updateMaixuRoomConfigItem,
  updateMaixuRoomConfigRaw,
} from '#/api/maixu/room';

import {
  COMMAND_DERIVED_KEY_LABELS,
  COMMAND_TO_CONFIG_KEY,
} from '../config-key-label-map';

const accessStore = useAccessStore();
const userStore = useUserStore();

const loading = ref(false);
const bindLoading = ref(false);
const bindCode = ref('');
const rooms = ref<MaixuRoomItem[]>([]);

const keyword = ref('');
const paginationCurrent = ref(1);
const paginationPageSize = ref(10);
const roomsTotal = ref(0);

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
const rawRoomConfig = ref<Record<string, any>>({});
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

const CONFIG_HIDDEN_KEYS = new Set([
  'expireTime',
  'expire_time',
  'isAIReply',
  'isChangeAnouncement',
]);

const CONFIG_SECTION_ORDER = [
  'basic',
  'koupai',
  'top',
  'stats',
  'other',
] as const;

const CONFIG_SECTION_TITLES: Record<(typeof CONFIG_SECTION_ORDER)[number], string> = {
  basic: '麦序基础配置',
  koupai: '扣排器相关设置',
  other: '其他配置',
  stats: '统计与打卡配置',
  top: '置顶卡相关配置',
};

const CONFIG_KEY_LABELS: Record<string, string> = {
  HomePeopleOrderStr: '打卡模板',
  adminWxids: '管理员WXID列表',
  announcement: '公告内容',
  bbLimitNum: 'BB限制次数',
  bbTimeMin: 'BB计时分钟',
  bb_timer_every_day: '每日BB定时',
  bind_bot_name: '绑定机器人名称',
  bind_bot_wxid: '绑定机器人WXID',
  bind_vip_seller: '绑定VIP销售',
  bind_vip_wxid: '绑定VIP账号WXID',
  caculatePercent: '统计百分比',
  cancelLimitValue: '取消阈值',
  cancel_rank_stop_minutes: '取消排麦截止分钟',
  card_max_num: '卡片上限数量',
  chaduiStoptMinutes: '插队截止分钟',
  clear_caculate_time: '清空统计时间',
  detect_kou_time: '扣排检测时段',
  emoj_info: '表情配置',
  empty_clear_num: '空场清理阈值',
  enter_top_expire_days: '进场置顶有效天数',
  enter_top_name: '进场置顶名称',
  enter_top_num: '进场置顶数量',
  expireTime: '过期时间',
  expire_time: '过期时间',
  handTopNum: '手动置顶次数',
  handTopValue: '手动置顶阈值',
  homePeopleStr: '主持文案',
  isAIReply: 'AI回复开关',
  isAddWipe: '补位开关',
  isAutoClearCaculate: '自动清理统计',
  isBBMention: 'BB提醒@',
  isCanCancel: '取排开关',
  isCarryMaixu: '携带麦序',
  isChangeAnouncement: '自动改公告',
  isCutRank: '截排开关',
  isDailyOrder: '每日麦序',
  isDetechMachine: '机器检测',
  isExitMention: '退场提醒@',
  isHandTop: '手动置顶开关',
  isHomePeopleOrderSend: '发送主持麦序播报',
  isHourShowCaculate: '小时统计展示',
  isLianPai: '连排开关',
  isMustAdmin: '仅管理员操作',
  isNewRankOutPut: '新版排榜输出',
  isOnlyMention: '仅@模式',
  isRegularOrder: '正则排麦',
  isStart: '启停开关',
  isSuperDetechMachine: '超级机器检测',
  isTopCard: '置顶卡开关',
  isVs: 'VS模式',
  is_add_first_zero: '首位补零',
  is_admin_black_record: '管理员黑名单记录',
  is_admin_black_zuofei: '管理员黑名单作废',
  is_always_show_rank: '始终展示排榜',
  is_at_koupaiqi: '@扣排器',
  is_auto_caculate: '自动统计',
  is_auto_clear_bb: '自动清空BB',
  is_auto_reply: '自动回复',
  is_bb_no_back_auto_cancel: 'BB无回应自动取消',
  is_caculate_order_cache: '统计缓存开关',
  is_calculate_task: '统计任务开关',
  is_card_task: '卡片任务开关',
  is_dai_kou: '代扣开关',
  is_easy_image_kou: '简易图片扣排',
  is_emoj_caculate_machine: '表情统计机审',
  is_emoj_kou: '表情扣排',
  is_emoj_not_same_machine: '表情不一致机审',
  is_emoj_number_machine: '表情数量机审',
  is_emoj_send: '表情发送开关',
  is_enter_send_card: '入场发卡',
  is_fake_code_kou_pai: '假码扣排',
  is_hour_click_in: '整点点入场',
  is_image_kou: '图片扣排',
  is_jiantou_number_machine: '箭头数量机审',
  is_move_order: '移动排麦',
  is_only_add_with_task: '仅任务可加排',
  is_paiyipai_kou: '拍一拍扣排',
  is_quote_kou: '引用扣排',
  is_random_fang_machine: '随机房机审',
  is_random_str_choose_chinese: '随机词中文',
  is_random_str_choose_num: '随机词数字',
  is_random_str_choose_str: '随机词字母',
  is_reback_qu: '回退区开关',
  is_record: '记录开关',
  is_record_bb: '记录BB',
  is_stop_send_daily_card: '停止发送日卡',
  is_upload_rank: '上传排榜',
  is_voice_kou: '语音扣排',
  mai8StoptMinutes: '麦8截止分钟',
  maxRank: '最大排麦人数',
  mini_chadui_value: '最小插队值',
  orderAddMinValue: '补排至少',
  orderAddMinutes: '加排分钟',
  orderStartMinutes: '开排分钟',
  orderStopMinutes: '停排分钟',
  orderTouMinutes: '偷排分钟',
  order_header_str: '排麦头部文案',
  overnight_time_range: '跨夜时间范围',
  rankKeyWord: '排麦关键词',
  regular_order_json: '正则排麦配置',
  roomId: '群ID',
  roomName: '群名称',
  self_record_keys_commands: '自定义记录命令',
  specialKeyJson: '特殊关键词映射',
  specialKeyStr: '打架规则',
  specialQA_str: '特殊问答文本',
  specialQAs: '特殊问答列表',
  special_vs_json: '单杀配置',
  superAdmins: '超级管理员列表',
  topNum: '置顶数量',
  top_control: '置顶控制',
  vs_max_num: 'VS最大人数',
  vs_mini_value: '单杀至少',
  vs_stop_time: 'VS截止时间',
};

function toConfigKey(key: string) {
  return COMMAND_TO_CONFIG_KEY[key] || key;
}

function formatConfigLabel(key: string) {
  const mappedKey = toConfigKey(key);
  const fromCommandMap = COMMAND_DERIVED_KEY_LABELS[mappedKey];
  if (fromCommandMap) {
    return fromCommandMap;
  }

  const fromLocalMap = CONFIG_KEY_LABELS[mappedKey];
  if (fromLocalMap) {
    return fromLocalMap;
  }

  return `${key} (待补充中文)`;
}

function isEditableConfigKey(key: string) {
  const mappedKey = toConfigKey(key);
  return !CONFIG_HIDDEN_KEYS.has(mappedKey) && !CONFIG_HIDDEN_KEYS.has(key);
}

function resolveConfigSection(key: string) {
  const mappedKey = toConfigKey(key);

  if (
    mappedKey.includes('top') ||
    mappedKey.includes('Top') ||
    mappedKey.startsWith('vs_') ||
    mappedKey === 'isTopCard' ||
    mappedKey === 'isVs' ||
    mappedKey === 'special_vs_json'
  ) {
    return 'top' as const;
  }

  if (
    mappedKey.includes('kou') ||
    mappedKey.includes('cancel') ||
    mappedKey.includes('Detech') ||
    mappedKey.includes('machine') ||
    mappedKey.includes('quote') ||
    mappedKey.includes('paiyipai') ||
    mappedKey.includes('bb_') ||
    mappedKey === 'isBBMention' ||
    mappedKey === 'bbLimitNum' ||
    mappedKey === 'bbTimeMin'
  ) {
    return 'koupai' as const;
  }

  if (
    mappedKey.includes('caculate') ||
    mappedKey.includes('calculate') ||
    mappedKey.includes('record') ||
    mappedKey.includes('card') ||
    mappedKey.includes('daily') ||
    mappedKey === 'HomePeopleOrderStr' ||
    mappedKey === 'order_header_str'
  ) {
    return 'stats' as const;
  }

  if (
    mappedKey.startsWith('order') ||
    mappedKey.startsWith('rank') ||
    mappedKey === 'isStart' ||
    mappedKey === 'maxRank' ||
    mappedKey === 'homePeopleStr' ||
    mappedKey === 'specialKeyStr' ||
    mappedKey === 'specialKeyJson' ||
    mappedKey === 'specialQAs' ||
    mappedKey === 'specialQA_str' ||
    mappedKey === 'isRegularOrder' ||
    mappedKey === 'isCutRank' ||
    mappedKey === 'isLianPai' ||
    mappedKey === 'isOnlyMention' ||
    mappedKey === 'isCarryMaixu'
  ) {
    return 'basic' as const;
  }

  return 'other' as const;
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
  total: keyword.value.trim() ? filteredRooms.value.length : roomsTotal.value,
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

const configFieldSections = computed(() => {
  const sectionMap = new Map<string, ConfigFieldItem[]>();
  for (const sectionKey of CONFIG_SECTION_ORDER) {
    sectionMap.set(sectionKey, []);
  }

  for (const item of configFields.value) {
    const section = resolveConfigSection(item.key);
    const list = sectionMap.get(section) || [];
    list.push(item);
    sectionMap.set(section, list);
  }

  return CONFIG_SECTION_ORDER.map((sectionKey) => {
    const items = (sectionMap.get(sectionKey) || []).toSorted((a, b) =>
      formatConfigLabel(a.key).localeCompare(formatConfigLabel(b.key), 'zh-CN'),
    );
    return {
      items,
      key: sectionKey,
      title: CONFIG_SECTION_TITLES[sectionKey],
    };
  }).filter((section) => section.items.length > 0);
});

const unmappedConfigKeys = computed(() => {
  const set = new Set<string>();
  for (const item of configFields.value) {
    const mappedKey = toConfigKey(item.key);
    if (!COMMAND_DERIVED_KEY_LABELS[mappedKey] && !CONFIG_KEY_LABELS[mappedKey]) {
      set.add(item.key);
    }
  }
  return [...set];
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

const canEditUserGroup = computed(() => hasCode('MX_USER_GROUP_EDIT'));

async function loadRooms(
  page = paginationCurrent.value,
  pageSize = paginationPageSize.value,
) {
  const username = currentUsername.value;
  if (!username) {
    message.warning('未获取到当前账号，请重新登录后重试');
    rooms.value = [];
    roomsTotal.value = 0;
    return;
  }

  loading.value = true;
  try {
    const bindingsResult = await queryUserRoomBindings({
      page,
      pageSize,
      userName: username,
    });

    paginationCurrent.value = bindingsResult.page;
    paginationPageSize.value = bindingsResult.pageSize;
    roomsTotal.value = bindingsResult.total;

    const bindings = bindingsResult.list;
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
  if (!canEditUserGroup.value) {
    message.warning('当前账号无群列表编辑权限');
    return;
  }

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
    await loadRooms(1, paginationPageSize.value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '绑定失败';
    message.error(errorMessage);
  } finally {
    bindLoading.value = false;
  }
}

function openConfigModal(record: MaixuRoomItem) {
  if (!canEditUserGroup.value) {
    message.warning('当前账号无群列表编辑权限');
    return;
  }

  selectedRoom.value = record;
  rawRoomConfig.value = { ...getRoomConfig(record) };
  configFields.value = Object.entries(rawRoomConfig.value)
    .filter(([key]) => isEditableConfigKey(key))
    .map(([key, value]) => buildConfigField(key, value));
  configModalOpen.value = true;
}

function parseConfigFieldValue(item: ConfigFieldItem) {
  if (item.type === 'boolean') {
    return item.boolValue;
  }
  if (item.type === 'int') {
    return Number.parseInt(item.textValue.trim(), 10);
  }
  if (item.type === 'float') {
    return Number.parseFloat(item.textValue.trim());
  }
  if (item.type === 'json') {
    return JSON.parse(item.textValue.trim());
  }
  return item.textValue;
}

function buildConfigPayload() {
  const payload: Record<string, any> = { ...rawRoomConfig.value };
  for (const item of configFields.value) {
    payload[item.key] = parseConfigFieldValue(item);
  }
  return payload;
}

async function saveConfig() {
  if (!canEditUserGroup.value) {
    message.warning('当前账号无群列表编辑权限');
    return;
  }

  if (!selectedRoom.value) {
    return;
  }
  if (configValidationMessage.value) {
    message.warning(configValidationMessage.value);
    return;
  }

  const payload = buildConfigPayload();
  const configRawJson = JSON.stringify(payload);
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
  if (!canEditUserGroup.value) {
    message.warning('当前账号无群列表编辑权限');
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
  if (!canEditUserGroup.value) {
    message.warning('当前账号无群列表编辑权限');
    return;
  }

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
    roomsTotal.value = Math.max(0, roomsTotal.value - 1);

    const fallbackPage = rooms.value.length === 0 && paginationCurrent.value > 1
      ? paginationCurrent.value - 1
      : paginationCurrent.value;
    await loadRooms(fallbackPage, paginationPageSize.value);

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
  const nextPage = pagination.current ?? 1;
  const nextSize = pagination.pageSize ?? 10;
  loadRooms(nextPage, nextSize);
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
        <Button
          :disabled="!canEditUserGroup"
          :loading="bindLoading"
          type="primary"
          @click="bindRoomByCode"
        >
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
                    <Menu.Item key="config-all" :disabled="!canEditUserGroup">
                      全部配置
                    </Menu.Item>
                  </Menu>
                </template>
              </Dropdown>

              <Button
                v-if="isRoomStarted(asRoom(record))"
                type="link"
                :disabled="!canEditUserGroup"
                @click="setRoomRunning(asRoom(record), false)"
              >
                暂停
              </Button>
              <Button
                v-else
                type="link"
                :disabled="!canEditUserGroup"
                @click="setRoomRunning(asRoom(record), true)"
              >
                恢复
              </Button>

              <Popconfirm
                title="确认删除该群吗？删除后会解除当前账号的绑定关系。"
                @confirm="removeRoom(asRoom(record))"
              >
                <Button danger type="link" :disabled="!canEditUserGroup">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="configModalOpen"
      :confirm-loading="configSaving"
      :ok-button-props="{ disabled: !!configValidationMessage || !canEditUserGroup }"
      title="全部配置"
      width="860px"
      wrap-class-name="maixu-user-config-modal"
      @ok="saveConfig"
    >
      <p
        v-if="configValidationMessage"
        class="mb-2"
        style="color: var(--ant-color-error)"
      >
        {{ configValidationMessage }}
      </p>
      <p
        v-if="unmappedConfigKeys.length > 0"
        class="mb-2 text-xs"
        style="color: var(--ant-color-warning)"
      >
        未匹配中文字段：{{ unmappedConfigKeys.join('、') }}
      </p>
      <div v-if="configFields.length === 0" class="opacity-70">暂无可配置项</div>
      <div v-else class="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <div
          v-for="section in configFieldSections"
          :key="section.key"
          class="config-section rounded-md p-3"
        >
          <div class="config-section-title mb-3 text-sm font-semibold">
            {{ section.title }}
          </div>

          <div class="space-y-3">
            <div
              v-for="item in section.items"
              :key="item.key"
              :class="[
                'py-1',
                item.type === 'textarea' || item.type === 'json'
                  ? 'space-y-2'
                  : 'flex items-center gap-3',
              ]"
            >
              <div class="config-item-label min-w-[220px] text-sm font-medium">
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

<style>
.maixu-user-config-modal .ant-modal-content,
.maixu-user-config-modal .ant-modal-header,
.maixu-user-config-modal .ant-modal-body,
.maixu-user-config-modal .ant-modal-footer {
  background: #1f232c;
  color: #e5e7eb;
}

.maixu-user-config-modal .ant-modal-header {
  border-bottom: 1px solid #343b4a;
}

.maixu-user-config-modal .ant-modal-footer {
  border-top: 1px solid #343b4a;
}

.maixu-user-config-modal .ant-modal-title,
.maixu-user-config-modal .ant-modal-close-x {
  color: #f3f4f6;
}

.maixu-user-config-modal .config-section {
  margin-bottom: 10px;
  background: #262d39;
  border: 1px solid #3a4456;
}

.maixu-user-config-modal .config-section-title {
  color: #f3f4f6;
}

.maixu-user-config-modal .config-item-label {
  color: #d1d5db;
}

.maixu-user-config-modal .ant-input,
.maixu-user-config-modal .ant-input-affix-wrapper,
.maixu-user-config-modal .ant-input-outlined,
.maixu-user-config-modal .ant-input-textarea-affix-wrapper,
.maixu-user-config-modal .ant-input-textarea {
  color: #f9fafb;
  background: #171b26;
  border-color: #30384a;
}

.maixu-user-config-modal .ant-input::placeholder,
.maixu-user-config-modal .ant-input-textarea textarea::placeholder {
  color: #8b95a7;
}

.maixu-user-config-modal .ant-switch {
  background: #576173;
}
</style>
