import { fetchMaixu } from './request';

export interface UserRoomBindingItem {
  createdAt?: string;
  roomName: string;
  roomWxid: string;
  sourceWxid?: string;
  updatedAt?: string;
  username?: string;
}

export interface QueryUserRoomBindingsParams {
  page?: number;
  pageSize?: number;
  userName: string;
}

export interface QueryUserRoomBindingsResult {
  list: UserRoomBindingItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ConsumeBindCodeResult {
  bindCode?: string;
  expiresAt?: string;
  roomName: string;
  roomWxid: string;
  sourceWxid?: string;
  username?: string;
}

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readErrorMessage(parsed: any, status: number) {
  if (parsed && typeof parsed === 'object') {
    const message = parsed.msg || parsed.message || parsed.error;
    if (message) {
      return String(message);
    }
  }
  return `请求失败(${status})`;
}

function readSuccessData(parsed: any) {
  if (parsed && typeof parsed === 'object' && 'code' in parsed) {
    if (Number(parsed.code) !== 0) {
      throw new Error(String(parsed.msg || parsed.message || '请求失败'));
    }
    return parsed.data;
  }
  return parsed;
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetchMaixu(path, init);

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    throw new Error(readErrorMessage(parsed, response.status));
  }

  return readSuccessData(parsed ?? text);
}

function normalizeBinding(value: any): UserRoomBindingItem {
  return {
    createdAt: String(value?.created_at || value?.createdAt || ''),
    roomName: String(value?.room_name || value?.roomName || ''),
    roomWxid: String(value?.room_wxid || value?.roomWxid || ''),
    sourceWxid: String(value?.from_wxid || value?.sourceWxid || ''),
    updatedAt: String(value?.update_time || value?.updatedAt || ''),
    username: String(value?.user_name || value?.username || ''),
  };
}

function normalizeConsumeResult(value: any): ConsumeBindCodeResult {
  return {
    bindCode: String(value?.bind_code || value?.bindCode || ''),
    expiresAt: String(value?.expire_time || value?.expiresAt || ''),
    roomName: String(value?.room_name || value?.roomName || ''),
    roomWxid: String(value?.room_wxid || value?.roomWxid || ''),
    sourceWxid: String(value?.from_wxid || value?.sourceWxid || ''),
    username: String(value?.user_name || value?.username || ''),
  };
}

export async function queryUserRoomBindings(
  params: QueryUserRoomBindingsParams,
) {
  const payload = {
    include_config: false,
    page: params.page ?? 1,
    page_size: params.pageSize ?? 20,
    user_name: params.userName,
  };

  const result = await requestJson('/v1/room_bind/list_user_rooms', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  const data = (result && result.data) || {};
  return {
    list: Array.isArray(data.list) ? data.list.map(normalizeBinding) : [],
    page: Number(data.page || 1),
    pageSize: Number(data.page_size || 20),
    total: Number(data.total || 0),
  } as QueryUserRoomBindingsResult;
}

export async function fetchUserRoomBindings(userName: string) {
  const data = await requestJson('/v1/room_bind/list_user_rooms', {
    body: JSON.stringify({ include_config: false, user_name: userName }),
    method: 'POST',
  });

  if (Array.isArray(data)) {
    return data.map(normalizeBinding);
  }

  if (data && typeof data === 'object' && Array.isArray((data as any).list)) {
    return (data as any).list.map(normalizeBinding);
  }

  return [];
}

export async function consumeUserRoomBindCode(code: string, userName: string) {
  const data = await requestJson('/v1/room_bind/bind_user_code', {
    body: JSON.stringify({ code, user_name: userName }),
    method: 'POST',
  });

  return normalizeConsumeResult(data || {});
}

export async function deleteUserRoomBinding(roomWxid: string, userName: string) {
  await requestJson('/v1/room_bind/unbind_user_room', {
    body: JSON.stringify({ room_wxid: roomWxid, user_name: userName }),
    method: 'POST',
  });
  return true;
}

export async function issueRoomBindCode(payload: {
  minutes?: number;
  roomName?: string;
  roomWxid: string;
  sourceWxid?: string;
}) {
  return requestJson('/v1/room_bind/issue_room_code', {
    body: JSON.stringify({
      expire_minutes: payload.minutes,
      from_wxid: payload.sourceWxid,
      room_name: payload.roomName,
      room_wxid: payload.roomWxid,
    }),
    method: 'POST',
  });
}
