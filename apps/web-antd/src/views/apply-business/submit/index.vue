<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  AutoComplete,
  Button,
  Card,
  DatePicker,
  Input,
  Modal,
  Space,
  Tag,
  message,
} from 'ant-design-vue';

import { getAccessCodesApi } from '#/api';
import {
  createExpireApproval,
  fetchApprovalRoomExpireInfo,
  fetchSuperAdminEmails,
  type ExpireRoomInfo,
} from '#/api/maixu/approval';
import { appendOperationLog } from '#/api/maixu/operation-log';
import {
  getNotifySettings,
  type NotifySettings,
} from '#/api/maixu/notify-settings';
import {
  fetchUserRoomBindings,
  type UserRoomBindingItem,
} from '#/api/maixu/user-room';

const accessStore = useAccessStore();
const userStore = useUserStore();

const loadingBindings = ref(false);
const boundRooms = ref<UserRoomBindingItem[]>([]);
const superAdminEmails = ref<string[]>([]);
const notifySettings = ref<NotifySettings | null>(null);

const modalOpen = ref(false);
const queryingRoomInfo = ref(false);
const saving = ref(false);
const roomInfo = ref<ExpireRoomInfo | null>(null);

const formState = reactive({
  reason: '',
  roomWxid: '',
  targetExpireTime: undefined as Dayjs | undefined,
});

const currentUsername = computed(() => {
  const account = userStore.userInfo?.username || userStore.userInfo?.email || '';
  return String(account).trim();
});

const currentUserEmail = computed(() => {
  return String(userStore.userInfo?.email || '').trim();
});

const currentUserRole = computed(() => {
  const roles = userStore.userInfo?.roles || [];
  if (roles.includes('super')) {
    return 'super';
  }
  if (roles.includes('admin')) {
    return 'admin';
  }
  return 'user';
});

function hasCode(code: string) {
  const roles = userStore.userInfo?.roles || [];
  if (roles.includes('super')) {
    return true;
  }
  return accessStore.accessCodes.includes(code);
}

const canSubmitApply = computed(() => hasCode('MX_APPLY_SUBMIT_EDIT'));

const roomOptions = computed(() =>
  boundRooms.value.map((item) => ({
    label: item.roomName ? `${item.roomName} (${item.roomWxid})` : item.roomWxid,
    value: item.roomWxid,
  })),
);



async function loadNotifySettings() {
  try {
    notifySettings.value = await getNotifySettings();
  } catch {
    notifySettings.value = null;
  }
}

async function loadSuperAdminEmails() {
  try {
    const list = await fetchSuperAdminEmails();
    superAdminEmails.value = [...new Set((list || []).map((item) => String(item || '').trim()).filter((item) => item.includes('@')) )];
  } catch {
    superAdminEmails.value = [];
  }
}


function filterRoomOption(input: string, option: any) {
  return String(option?.label || '')
    .toLowerCase()
    .includes(input.toLowerCase());
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

async function syncAccessCodes() {
  try {
    const latestCodes = await getAccessCodesApi();
    accessStore.setAccessCodes(latestCodes);
  } catch {
    // ignore sync failure
  }
}

async function loadBoundRooms() {
  const username = currentUsername.value;
  if (!username) {
    return;
  }

  loadingBindings.value = true;
  try {
    const list = await fetchUserRoomBindings(username);
    boundRooms.value = dedupeBindings(list);
    if (!formState.roomWxid && boundRooms.value.length > 0) {
      formState.roomWxid = boundRooms.value[0]?.roomWxid || '';
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载绑定群失败');
  } finally {
    loadingBindings.value = false;
  }
}

function openExpireApplyModal() {
  if (!canSubmitApply.value) {
    message.warning('当前账号无提交申请权限');
    return;
  }

  modalOpen.value = true;
  roomInfo.value = null;
  formState.reason = '';
  formState.targetExpireTime = undefined;
  if (!formState.roomWxid && boundRooms.value.length > 0) {
    formState.roomWxid = boundRooms.value[0]?.roomWxid || '';
  }
}

async function queryRoomInfo() {
  const roomWxid = formState.roomWxid.trim();
  if (!roomWxid) {
    message.warning('请先输入群ID');
    return;
  }

  queryingRoomInfo.value = true;
  try {
    const username = currentUsername.value;
    if (!username) {
      message.warning('未获取到当前账号，请重新登录后重试');
      return;
    }

    const info = await fetchApprovalRoomExpireInfo({
      roomWxid,
      userName: username,
      userRole: currentUserRole.value,
    });
    roomInfo.value = info;
    message.success('群信息已加载');
  } catch (error) {
    roomInfo.value = null;
    message.error(error instanceof Error ? error.message : '群信息查询失败');
  } finally {
    queryingRoomInfo.value = false;
  }
}

async function submitApply() {
  if (!canSubmitApply.value) {
    message.warning('当前账号无提交申请权限');
    return;
  }

  const username = currentUsername.value;
  if (!username) {
    message.warning('未获取到当前账号，请重新登录后重试');
    return;
  }

  if (!roomInfo.value) {
    message.warning('请先查询群信息');
    return;
  }
  if (!formState.targetExpireTime) {
    message.warning('请选择新的过期时间');
    return;
  }
  if (!formState.reason.trim()) {
    message.warning('请填写申请理由');
    return;
  }

  const targetExpireTime = formState.targetExpireTime.format('YYYY-MM-DD HH:mm:ss');

  saving.value = true;
  try {
    const record = await createExpireApproval({
      notifyConfig: notifySettings.value
        ? {
            bodyTemplate: notifySettings.value.approvalBodyTemplate,
            fromEmail: notifySettings.value.fromEmail,
            fromName: notifySettings.value.fromName,
            smtpHost: notifySettings.value.smtpHost,
            smtpPassword: notifySettings.value.smtpPassword,
            smtpPort: notifySettings.value.smtpPort,
            smtpUsername: notifySettings.value.smtpUsername,
            subjectTemplate: notifySettings.value.approvalSubjectTemplate,
            useSSL: notifySettings.value.useSSL,
          }
        : undefined,
      notifyEmails: superAdminEmails.value,
      reason: formState.reason.trim(),
      roomWxid: roomInfo.value.room_wxid,
      targetExpireTime,
      userEmail: currentUserEmail.value,
      userName: username,
      userRole: currentUserRole.value,
    });

    await appendOperationLog('申请业务/提交申请', '提交过期时间修改申请', {
      request_no: record.request_no,
      room_wxid: record.room_wxid,
      target_expire_time: record.target_expire_time,
    });

    modalOpen.value = false;
    message.success(`提交成功：${record.request_no}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '提交失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await syncAccessCodes();
  await loadBoundRooms();
  await loadSuperAdminEmails();
  await loadNotifySettings();
});
</script>

<template>
  <Page title="申请业务 / 提交申请" description="选择业务单据并提交审批，当前预设“过期时间修改”审批单。">
    <Card>
      <Space direction="vertical" size="large" style="width: 100%">
        <div class="text-sm opacity-80">
          普通管理员和用户可提交申请，超级管理员可审批；24小时未处理系统自动同意。
        </div>

        <div>
          <Button type="primary" :disabled="!canSubmitApply" @click="openExpireApplyModal">
            申请修改过期时间
          </Button>
        </div>
      </Space>
    </Card>

    <Modal
      v-model:open="modalOpen"
      :confirm-loading="saving"
      :ok-button-props="{ disabled: !canSubmitApply }"
      title="申请修改过期时间"
      width="760px"
      @ok="submitApply"
    >
      <div class="space-y-3">
        <div class="flex w-full items-start gap-3">
          <AutoComplete
            v-model:value="formState.roomWxid"
            :options="roomOptions"
            allow-clear
            class="min-w-0 flex-1"
            placeholder="输入或选择群ID"
            :filter-option="filterRoomOption"
            style="width: 100%"
          />
          <Button :loading="queryingRoomInfo" @click="queryRoomInfo">查询群信息</Button>
        </div>

        <Card size="small" v-if="roomInfo">
          <div class="space-y-2 text-sm">
            <div>
              <Tag color="blue">群昵称</Tag>
              {{ roomInfo.room_name || '-' }}
            </div>
            <div>
              <Tag color="geekblue">群ID</Tag>
              {{ roomInfo.room_wxid }}
            </div>
            <div>
              <Tag color="purple">当前过期时间</Tag>
              {{ roomInfo.current_expire_time || '未设置' }}
            </div>
          </div>
        </Card>

        <div>
          <div class="mb-1 text-sm">新的过期时间</div>
          <DatePicker
            v-model:value="formState.targetExpireTime"
            :show-time="{ format: 'HH:mm:ss' }"
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择新的过期时间"
            style="width: 100%"
          />
        </div>

        <div>
          <div class="mb-1 text-sm">申请理由</div>
          <Input.TextArea
            v-model:value="formState.reason"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            placeholder="请填写申请理由"
          />
        </div>
      </div>
    </Modal>
  </Page>
</template>
