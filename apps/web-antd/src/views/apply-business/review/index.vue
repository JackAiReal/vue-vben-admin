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
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import {
  approveTask,
  getApprovalDetail,
  queryApprovalTasks,
  rejectTask,
  type ExpireApprovalRecord,
} from '#/api/maixu/approval';
import { appendOperationLog } from '#/api/maixu/operation-log';

const { RangePicker } = DatePicker;

const accessStore = useAccessStore();
const userStore = useUserStore();

const loading = ref(false);
const rows = ref<ExpireApprovalRecord[]>([]);
const total = ref(0);

const paginationCurrent = ref(1);
const paginationPageSize = ref(20);

const queryState = reactive({
  applicantUser: '',
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
  { title: '提交人', dataIndex: 'applicant_user', key: 'applicant_user', width: 120 },
  { title: '群昵称', dataIndex: 'room_name', key: 'room_name', width: 150, ellipsis: true },
  { title: '群ID', dataIndex: 'room_wxid', key: 'room_wxid', width: 220, ellipsis: true },
  { title: '目标过期', dataIndex: 'target_expire_time', key: 'target_expire_time', width: 170 },
  { title: '状态', key: 'approval_status', width: 100 },
  { title: '提交时间', dataIndex: 'submitted_at', key: 'submitted_at', width: 170 },
  { title: '操作', key: 'actions', width: 240, fixed: 'right' },
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

const isSuper = computed(() => {
  const roles = userStore.userInfo?.roles || [];
  return roles.includes('super');
});

function hasCode(code: string) {
  const roles = userStore.userInfo?.roles || [];
  if (roles.includes('super')) {
    return true;
  }
  return accessStore.accessCodes.includes(code);
}

const canReviewApply = computed(
  () => isSuper.value && hasCode('MX_APPLY_REVIEW_EDIT'),
);

const detailOpen = ref(false);
const detailRecord = ref<ExpireApprovalRecord | null>(null);

const rejectOpen = ref(false);
const rejectSaving = ref(false);
const rejectState = reactive({
  id: 0,
  note: '',
});

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
  if (!canReviewApply.value) {
    rows.value = [];
    total.value = 0;
    return;
  }

  const operatorUser = currentUsername.value;
  if (!operatorUser) {
    return;
  }

  loading.value = true;
  try {
    const hasRange = !!(queryState.timeRange && queryState.timeRange.length === 2);

    const result = await queryApprovalTasks({
      applicantUser: queryState.applicantUser.trim() || undefined,
      approvalStatus: queryState.approvalStatus || undefined,
      end: hasRange ? toDateText(queryState.timeRange?.[1]?.endOf('day')) : undefined,
      keyword: queryState.keyword.trim() || undefined,
      operatorUser,
      page,
      pageSize,
      roomWxid: queryState.roomWxid.trim() || undefined,
      start: hasRange ? toDateText(queryState.timeRange?.[0]?.startOf('day')) : undefined,
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

async function doApprove(record: ExpireApprovalRecord) {
  if (!canReviewApply.value) {
    message.warning('当前账号无审批操作权限');
    return;
  }
  if (record.approval_status !== 'pending') {
    message.warning('当前状态不可同意');
    return;
  }

  const operatorUser = currentUsername.value;
  if (!operatorUser) {
    return;
  }

  try {
    const result = await approveTask({ id: record.id, operatorUser });
    await appendOperationLog('申请业务/我的审批', '同意审批单', {
      request_no: result.request_no,
      room_wxid: result.room_wxid,
    });
    message.success('已同意');
    await loadData(paginationCurrent.value, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败');
  }
}

function openReject(record: ExpireApprovalRecord) {
  if (!canReviewApply.value) {
    message.warning('当前账号无审批操作权限');
    return;
  }

  if (record.approval_status !== 'pending') {
    message.warning('当前状态不可驳回');
    return;
  }

  rejectState.id = record.id;
  rejectState.note = '';
  rejectOpen.value = true;
}

async function submitReject() {
  if (!canReviewApply.value) {
    message.warning('当前账号无审批操作权限');
    return;
  }

  const operatorUser = currentUsername.value;
  if (!operatorUser) {
    return;
  }
  if (!rejectState.note.trim()) {
    message.warning('请填写驳回理由');
    return;
  }

  rejectSaving.value = true;
  try {
    const result = await rejectTask({
      id: rejectState.id,
      note: rejectState.note.trim(),
      operatorUser,
    });

    await appendOperationLog('申请业务/我的审批', '驳回审批单', {
      request_no: result.request_no,
      room_wxid: result.room_wxid,
      note: rejectState.note.trim(),
    });

    rejectOpen.value = false;
    message.success('已驳回');
    await loadData(paginationCurrent.value, paginationPageSize.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败');
  } finally {
    rejectSaving.value = false;
  }
}

loadData(1, paginationPageSize.value);
</script>

<template>
  <Page title="申请业务 / 我的审批" description="超级管理员审批中心，可同意或驳回过期时间修改申请。">
    <Card v-if="!canReviewApply">
      <div class="text-sm">当前账号暂无审批操作权限。</div>
    </Card>

    <template v-else>
      <Card class="mb-4">
        <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Input v-model:value="queryState.applicantUser" placeholder="提交人" />
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
          :scroll="{ x: 1500 }"
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
                  :disabled="asRow(record).approval_status !== 'pending'"
                  @click="doApprove(asRow(record))"
                >
                  同意
                </Button>
                <Button
                  size="small"
                  danger
                  type="link"
                  :disabled="asRow(record).approval_status !== 'pending'"
                  @click="openReject(asRow(record))"
                >
                  驳回
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>
    </template>

    <Modal v-model:open="detailOpen" :footer="null" title="审批详情" width="720px">
      <div v-if="detailRecord" class="space-y-2 text-sm">
        <div><b>审批单号：</b>{{ detailRecord.request_no }}</div>
        <div><b>申请人：</b>{{ detailRecord.applicant_user }}</div>
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
      v-model:open="rejectOpen"
      :confirm-loading="rejectSaving"
      title="驳回审批单"
      width="600px"
      @ok="submitReject"
    >
      <Input.TextArea
        v-model:value="rejectState.note"
        :auto-size="{ minRows: 4, maxRows: 8 }"
        placeholder="请输入驳回理由"
      />
    </Modal>
  </Page>
</template>
