import { requestClient } from '#/api/request';

import { fetchMaixu } from './request';

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetchMaixu(path, init);

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const message =
      (parsed && (parsed.msg || parsed.message || parsed.error)) ||
      `请求失败(${response.status})`;
    throw new Error(String(message));
  }

  if (parsed && typeof parsed === 'object' && 'code' in parsed && parsed.code !== 0) {
    throw new Error(String(parsed.msg || '请求失败'));
  }

  return parsed ?? text;
}

export interface ExpireRoomInfo {
  current_expire_time: string;
  room_name: string;
  room_wxid: string;
}

export type ApprovalStatus =
  | 'approved'
  | 'cancelled'
  | 'pending'
  | 'processing'
  | 'rejected';

export interface ExpireApprovalRecord {
  applicant_email: string;
  applicant_user: string;
  approval_status: ApprovalStatus;
  auto_approve_at: string;
  current_expire_time: string;
  id: number;
  is_auto_approved: number;
  notify_emails: string[];
  reason: string;
  request_no: string;
  request_type: string;
  request_type_label: string;
  review_note: string;
  review_source: string;
  reviewed_at: string;
  reviewer_user: string;
  room_name: string;
  room_wxid: string;
  submitted_at: string;
  target_expire_time: string;
  update_time: string;
}

export interface ApprovalListResult {
  list: ExpireApprovalRecord[];
  page: number;
  pageSize: number;
  total: number;
}

function normalizeRecord(value: any): ExpireApprovalRecord {
  return {
    applicant_email: String(value?.applicant_email || ''),
    applicant_user: String(value?.applicant_user || ''),
    approval_status: String(value?.approval_status || 'pending') as ApprovalStatus,
    auto_approve_at: String(value?.auto_approve_at || ''),
    current_expire_time: String(value?.current_expire_time || ''),
    id: Number(value?.id || 0),
    is_auto_approved: Number(value?.is_auto_approved || 0),
    notify_emails: Array.isArray(value?.notify_emails)
      ? value.notify_emails.map((item: unknown) => String(item || ''))
      : [],
    reason: String(value?.reason || ''),
    request_no: String(value?.request_no || ''),
    request_type: String(value?.request_type || ''),
    request_type_label: String(value?.request_type_label || ''),
    review_note: String(value?.review_note || ''),
    review_source: String(value?.review_source || ''),
    reviewed_at: String(value?.reviewed_at || ''),
    reviewer_user: String(value?.reviewer_user || ''),
    room_name: String(value?.room_name || ''),
    room_wxid: String(value?.room_wxid || ''),
    submitted_at: String(value?.submitted_at || ''),
    target_expire_time: String(value?.target_expire_time || ''),
    update_time: String(value?.update_time || ''),
  };
}

export async function fetchApprovalRoomExpireInfo(payload: {
  roomWxid: string;
  userName: string;
  userRole: string;
}) {
  const result = await requestJson('/v1/approval/room_expire_info', {
    body: JSON.stringify({
      room_wxid: payload.roomWxid,
      user_name: payload.userName,
      user_role: payload.userRole,
    }),
    method: 'POST',
  });
  const data = result?.data || {};
  return {
    current_expire_time: String(data.current_expire_time || ''),
    room_name: String(data.room_name || ''),
    room_wxid: String(data.room_wxid || ''),
  } as ExpireRoomInfo;
}

export interface ApprovalNotifyConfig {
  bodyTemplate: string;
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPassword: string;
  smtpPort: number;
  smtpUsername: string;
  subjectTemplate: string;
  useSSL: boolean;
}

export async function createExpireApproval(payload: {
  notifyConfig?: ApprovalNotifyConfig;
  notifyEmails?: string[];
  reason: string;
  roomWxid: string;
  targetExpireTime: string;
  userEmail?: string;
  userName: string;
  userRole: string;
}) {
  const result = await requestJson('/v1/approval/create_expire_change', {
    body: JSON.stringify({
      notify_config: payload.notifyConfig,
      notify_emails: payload.notifyEmails,
      reason: payload.reason,
      room_wxid: payload.roomWxid,
      target_expire_time: payload.targetExpireTime,
      user_email: payload.userEmail,
      user_name: payload.userName,
      user_role: payload.userRole,
    }),
    method: 'POST',
  });
  return normalizeRecord(result?.data || {});
}

function normalizeListResult(raw: any): ApprovalListResult {
  const data = raw?.data || {};
  return {
    list: Array.isArray(data.list) ? data.list.map(normalizeRecord) : [],
    page: Number(data.page || 1),
    pageSize: Number(data.page_size || data.pageSize || 20),
    total: Number(data.total || 0),
  };
}

export async function queryMyApprovals(params: {
  approvalStatus?: string;
  end?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  roomWxid?: string;
  start?: string;
  userName: string;
}) {
  const result = await requestJson('/v1/approval/my_list', {
    body: JSON.stringify({
      approval_status: params.approvalStatus,
      end: params.end,
      keyword: params.keyword,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      room_wxid: params.roomWxid,
      start: params.start,
      user_name: params.userName,
    }),
    method: 'POST',
  });

  return normalizeListResult(result);
}

export async function resubmitMyApproval(payload: {
  id: number;
  notifyConfig?: ApprovalNotifyConfig;
  notifyEmails?: string[];
  reason: string;
  roomWxid: string;
  targetExpireTime: string;
  userName: string;
  userRole: string;
}) {
  const result = await requestJson('/v1/approval/my_update_resubmit', {
    body: JSON.stringify({
      id: payload.id,
      notify_config: payload.notifyConfig,
      notify_emails: payload.notifyEmails,
      reason: payload.reason,
      room_wxid: payload.roomWxid,
      target_expire_time: payload.targetExpireTime,
      user_name: payload.userName,
      user_role: payload.userRole,
    }),
    method: 'POST',
  });

  return normalizeRecord(result?.data || {});
}

export async function cancelMyApproval(id: number, userName: string) {
  const result = await requestJson('/v1/approval/my_cancel', {
    body: JSON.stringify({ id, user_name: userName }),
    method: 'POST',
  });

  return normalizeRecord(result?.data || {});
}

export async function getApprovalDetail(id: number, userName: string) {
  const result = await requestJson('/v1/approval/detail', {
    body: JSON.stringify({ id, user_name: userName }),
    method: 'POST',
  });

  return normalizeRecord(result?.data || {});
}

export async function queryApprovalTasks(params: {
  applicantUser?: string;
  approvalStatus?: string;
  end?: string;
  keyword?: string;
  operatorUser: string;
  page?: number;
  pageSize?: number;
  roomWxid?: string;
  start?: string;
}) {
  const result = await requestJson('/v1/approval/approval_list', {
    body: JSON.stringify({
      applicant_user: params.applicantUser,
      approval_status: params.approvalStatus,
      end: params.end,
      keyword: params.keyword,
      operator_user: params.operatorUser,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      room_wxid: params.roomWxid,
      start: params.start,
    }),
    method: 'POST',
  });

  return normalizeListResult(result);
}

export async function fetchSuperAdminEmails() {
  return requestClient.post<string[]>('/rbac/users/super-emails');
}

export async function approveTask(payload: {
  id: number;
  note?: string;
  operatorUser: string;
}) {
  const result = await requestJson('/v1/approval/approve', {
    body: JSON.stringify({
      id: payload.id,
      note: payload.note,
      operator_user: payload.operatorUser,
    }),
    method: 'POST',
  });

  return normalizeRecord(result?.data || {});
}

export async function rejectTask(payload: {
  id: number;
  note: string;
  operatorUser: string;
}) {
  const result = await requestJson('/v1/approval/reject', {
    body: JSON.stringify({
      id: payload.id,
      note: payload.note,
      operator_user: payload.operatorUser,
    }),
    method: 'POST',
  });

  return normalizeRecord(result?.data || {});
}
