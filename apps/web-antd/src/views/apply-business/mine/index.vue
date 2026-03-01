<script lang="ts" setup>
import type { Dayjs } from 'dayjs';
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import { computed, onMounted, reactive, ref } from 'vue';

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

import { getAccessCodesApi } from '#/api';
import {
  cancelMyApproval,
  fetchApprovalRoomExpireInfo,
  fetchSuperAdminEmails,
  getApprovalDetail,
  queryMyApprovals,
  resubmitMyApproval,
  type ExpireApprovalRecord,
} from '#/api/maixu/approval';
import { appendOperationLog } from '#/api/maixu/operation-log';
import {
  getNotifySettings,
  type NotifySettings,
} from '#/api/maixu/notify-settings';

const { RangePicker } = DatePicker;

const accessStore = useAccessStore();
const userStore = useUserStore();

const loading = ref(false);
const rows = ref<ExpireApprovalRecord[]>([]);
const total = ref(0);

const paginationCurrent = ref(1);
const paginationPageSize = ref(20);

const queryState = reactive({
  approvalStatus: '',
  keyword: '',
  roomWxid: '',
  timeRange: undefined as [Dayjs, Dayjs] | undefined,
});

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待审批', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已同意', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
  { label: '已撤回', value: 'cancelled' },
];

const columns: TableColumnsType<ExpireApprovalRecord> = [
  { title: '单号', dataIndex: 'request_no', key: 'request_no', width: 200 },
  { title: '群昵称', dataIndex: 'room_name', key: 'room_name', width: 150, ellipsis: true },
  { title: '群ID', dataIndex: 'room_wxid', key: 'room_wxid', width: 220, ellipsis: true },
  { title: '当前过期', dataIndex: 'current_expire_time', key: 'current_expire_time', width: 170 },
  { title: '目标过期', dataIndex: 'target_expire_time', key: 'target_expire_time', width: 170 },
  { title: '状态', key: 'approval_status', width: 110 },
  { title: '提交时间', dataIndex: 'submitted_at', key: 'submitted_at', width: 170 },
  { title: '自动处理时间', dataIndex: 'auto_approve_at', key: 'auto_approve_at', width: 170 },
  { title: '操作', key: 'actions', width: 220, fixed: 'right' },
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

const canEditMyApply = computed(() => hasCode('MX_APPLY_MINE_EDIT'));

const superAdminEmails = ref<string[]>([]);
const notifySettings = ref<NotifySettings | null>(null);

const detailOpen = ref(false);
const detailRecord = ref<ExpireApprovalRecord | null>(null);

const editOpen = ref(false);
const editSaving = ref(false);
const editState = reactive({
  id: 0,
  notifyEmails: [] as string[],
  reason: '',
  roomWxid: '',
  roomName: '',
  targetExpireTime: undefined as Dayjs | undefined,
});

async function syncAccessCodes() {
  try {
    const latestCodes = await getAccessCodesApi();
    accessStore.setAccessCodes(latestCodes);
  } catch {
    // ignore sync failure
  }
}

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

function statusTagColor(status: string) {
  if (status === 'approved') {
    return 'green';
  }
  if (status === 'rejected') {
    return 'red';
  }
  if (status === 'cancelled') {
    return 'default';
  }
  if (status === 'processing') {
    return 'blue';
  }
  return 'gold';
}

function statusLabel(status: string) {
  const mapping: Record<string, string> = {
    approved: '已同意',
    cancelled: '已撤回',
    pending: '待审批',
    processing: '处理中',
    rejected: '已驳回',
  };
  return mapping[status] || status;
}

function asRow(record: Record<string, any>) {
  return record as ExpireApprovalRecord;
}

function toDateText(value?: Dayjs | null) {
  if (!value) {
    return '';
  }
  return value.format('YYYY-MM-DD HH:mm:ss');
}

async function loadData(page = paginationCurrent.value, pageSize = paginationPageSize.value) {
  const username = currentUsername.value;
  if (!username) {
    message.warning('未获取到当前账号，请重新登录后重试');
    return;
  }

  loading.value = true;
  try {
    const hasRange = !!(queryState.timeRange && queryState.timeRange.length === 2);

    const result = await queryMyApprovals({
      approvalStatus: queryState.approvalStatus || undefined,
      end: hasRange ? toDateText(queryState.timeRange?.[1]?.endOf('day')) : undefined,
      keyword: queryState.keyword.trim() || undefined,
      page,
      pageSize,
      roomWxid: queryState.roomWxid.trim() || undefined,
      start: hasRange ? toDateText(queryState.timeRange?.[0]?.startOf('day')) : undefined,
      userName: username,
    });

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

async function openDetail(record: ExpireApprovalRecord) {
  const username = currentUsername.value;
  if (!username) {
    return;
  }
  try {
    detailRecord.value = await getApprovalDetail(record.id, username);
    detailOpen.value = true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '查询详情失败');
  }
}

async function openEdit(record: ExpireApprovalRecord) {
  if (!canEditMyApply.value) {
    message.warning('当前账号无申请编辑权限');
    return;
  }

  if (!['pending', 'rejected', 'cancelled'].includes(record.approval_status)) {
    message.warning('当前状态不支持重新提交');
    return;
  }

  try {
    const roomInfo = await fetchApprovalRoomExpireInfo({
      roomWxid: record.room_wxid,
      userName: currentUsername.value,
      userRole: currentUserRole.value,
    });
    editState.id = record.id;
    editState.roomWxid = roomInfo.room_wxid;
    editState.roomName = roomInfo.room_name;
    editState.reason = record.reason;
    editState.notifyEmails = Array.isArray(record.notify_emails) ? record.notify_emails : [];
    editState.targetExpireTime = record.target_expire_time
      ? dayjs(record.target_expire_time)
      : undefined;
    editOpen.value = true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '读取群信息失败');
  }
}

async function submitEdit() {
  if (!canEditMyApply.value) {
    message.warning('当前账号无申请编辑权限');
    return;
  }

  const username = currentUsername.value;
  if (!username) {
    return;
  }
  if (!editState.roomWxid.trim()) {
    message.warning('群ID不能为空');
    return;
  }
  if (!editState.targetExpireTime) {
    message.warning('请选择新的过期时间');
    return;
  }
  if (!editState.reason.trim()) {
    message.warning('请填写申请理由');
    return;
  }

  editSaving.value = true;
  try {
    const targetExpireTime = editState.targetExpireTime.format('YYYY-MM-DD HH:mm:ss');
    const record = await resubmitMyApproval({
      id: editState.id,
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
      notifyEmails: editState.notifyEmails.length > 0 ? editState.notifyEmails : superAdminEmails.value,
      reason: editState.reason.trim(),
      roomWxid: editState.roomWxid,
      targetExpireTime,
      userName: username,
      userRole: currentUserRole.value,
    });

    await appendOperationLog('申请业务/我的申请', '修改并重新提交审批单', {
      request_no: record.request_no,
      room_wxid: record.room_wxid,
    });

    editOpen.value = false;
    message.success('重新提交成功');
    await loadSuperAdminEmails();
    await loadNotifySettings();
    await loadData(1, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重新提交失败');
  } finally {
    editSaving.value = false;
  }
}

async function cancelOne(record: ExpireApprovalRecord) {
  if (!canEditMyApply.value) {
    message.warning('当前账号无申请编辑权限');
    return;
  }

  const username = currentUsername.value;
  if (!username) {
    return;
  }

  try {
    const result = await cancelMyApproval(record.id, username);

    await appendOperationLog('申请业务/我的申请', '撤回审批单', {
      request_no: result.request_no,
      room_wxid: result.room_wxid,
    });

    message.success('撤回成功');
    await loadData(paginationCurrent.value, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '撤回失败');
  }
}

onMounted(async () => {
  await syncAccessCodes();
  await loadSuperAdminEmails();
  await loadNotifySettings();
  await loadData(1, paginationPageSize.value);
});
</script>

<template>
  <Page title="申请业务 / 我的申请" description="查看和管理自己提交的审批单，支持修改重提和撤回。">
    <Card class="mb-4">
      <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <Input v-model:value="queryState.roomWxid" placeholder="群ID" />
        <Select v-model:value="queryState.approvalStatus" :options="statusOptions" placeholder="审批状态" />
        <RangePicker v-model:value="queryState.timeRange" format="YYYY-MM-DD" style="width: 100%" />
        <Input v-model:value="queryState.keyword" placeholder="关键字（单号/群ID/理由）" />
      </div>
      <Space>
        <Button type="primary" @click="loadData(1, paginationPageSize)">查询</Button>
      </Space>
    </Card>

    <Card>
      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="tablePagination"
        :scroll="{ x: 1650 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'approval_status'">
            <Tag :color="statusTagColor(asRow(record).approval_status)">
              {{ statusLabel(asRow(record).approval_status) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <Space>
              <Button size="small" type="link" @click="openDetail(asRow(record))">详情</Button>
              <Button
                size="small"
                type="link"
                :disabled="!canEditMyApply || !['pending', 'rejected', 'cancelled'].includes(asRow(record).approval_status)"
                @click="openEdit(asRow(record))"
              >
                修改重提
              </Button>
              <Popconfirm
                title="确认撤回该审批单吗？"
                @confirm="cancelOne(asRow(record))"
              >
                <Button
                  size="small"
                  danger
                  type="link"
                  :disabled="!canEditMyApply || asRow(record).approval_status !== 'pending'"
                >
                  撤回
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal v-model:open="detailOpen" :footer="null" title="审批详情" width="700px">
      <div v-if="detailRecord" class="space-y-2 text-sm">
        <div><b>审批单号：</b>{{ detailRecord.request_no }}</div>
        <div><b>申请类型：</b>{{ detailRecord.request_type_label }}</div>
        <div><b>群昵称：</b>{{ detailRecord.room_name }}</div>
        <div><b>群ID：</b>{{ detailRecord.room_wxid }}</div>
        <div><b>当前过期时间：</b>{{ detailRecord.current_expire_time || '-' }}</div>
        <div><b>目标过期时间：</b>{{ detailRecord.target_expire_time }}</div>
        <div><b>申请理由：</b>{{ detailRecord.reason }}</div>
        <div><b>审批状态：</b>{{ statusLabel(detailRecord.approval_status) }}</div>
        <div><b>审批备注：</b>{{ detailRecord.review_note || '-' }}</div>
        <div><b>审批人：</b>{{ detailRecord.reviewer_user || '-' }}</div>
      </div>
    </Modal>

    <Modal
      v-model:open="editOpen"
      :confirm-loading="editSaving"
      :ok-button-props="{ disabled: !canEditMyApply }"
      title="修改并重新提交"
      width="760px"
      @ok="submitEdit"
    >
      <div class="space-y-3">
        <div><b>群昵称：</b>{{ editState.roomName || '-' }}</div>
        <div><b>群ID：</b>{{ editState.roomWxid }}</div>

        <div>
          <div class="mb-1 text-sm">新的过期时间</div>
          <DatePicker
            v-model:value="editState.targetExpireTime"
            :show-time="{ format: 'HH:mm:ss' }"
            format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </div>

        <div>
          <div class="mb-1 text-sm">申请理由</div>
          <Input.TextArea
            v-model:value="editState.reason"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            placeholder="请填写申请理由"
          />
        </div>
      </div>
    </Modal>
  </Page>
</template>
