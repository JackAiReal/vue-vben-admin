export interface WxRoomMember {
  id: number;
  wxid: string;
  room_wxid: string;
  account: string;
  nickname: string;
  display_name: string;
  avatar?: string;
  sex?: number;
  city: string;
  country: string;
  province: string;
  remark: string;
  update_time: string;
}

export interface QueryWxRoomMemberParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
  roomWxid: string;
}

export interface QueryWxRoomMemberResult {
  list: WxRoomMember[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SaveWxRoomMemberPayload {
  account?: string;
  avatar?: string;
  city?: string;
  country?: string;
  display_name?: string;
  id?: number;
  nickname?: string;
  province?: string;
  remark?: string;
  room_wxid: string;
  sex?: number;
  wxid: string;
}

function getApiBaseUrl() {
  const envBase = import.meta.env.VITE_GINGER_API_URL as string | undefined;
  if (envBase && envBase.trim()) {
    return envBase.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:5000`;
  }

  return 'http://127.0.0.1:5000';
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeMember(value: any): WxRoomMember {
  return {
    id: Number(value?.id ?? 0),
    wxid: String(value?.wxid ?? ''),
    room_wxid: String(value?.room_wxid ?? ''),
    account: String(value?.account ?? ''),
    nickname: String(value?.nickname ?? ''),
    display_name: String(value?.display_name ?? ''),
    avatar: value?.avatar,
    sex: typeof value?.sex === 'number' ? value.sex : undefined,
    city: String(value?.city ?? ''),
    country: String(value?.country ?? ''),
    province: String(value?.province ?? ''),
    remark: String(value?.remark ?? ''),
    update_time: String(value?.update_time ?? ''),
  };
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const parsed = text ? safeJsonParse(text) : null;

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

export async function queryWxRoomMembers(params: QueryWxRoomMemberParams) {
  const payload = {
    keyword: params.keyword,
    page: params.page ?? 1,
    page_size: params.pageSize ?? 20,
    room_wxid: params.roomWxid,
  };

  const result = await requestJson('/v1/wx_room_user/query', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  const data = (result && result.data) || {};
  return {
    list: Array.isArray(data.list) ? data.list.map(normalizeMember) : [],
    page: Number(data.page || 1),
    pageSize: Number(data.page_size || 20),
    total: Number(data.total || 0),
  } as QueryWxRoomMemberResult;
}

export async function saveWxRoomMember(payload: SaveWxRoomMemberPayload) {
  if (payload.id) {
    const result = await requestJson('/v1/wx_room_user/update_by_id', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
    return {
      msg: result?.msg || '更新成功',
      record: normalizeMember(result?.data || {}),
    };
  }

  const result = await requestJson('/v1/wx_room_user/create', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
  return {
    msg: result?.msg || '创建成功',
    record: normalizeMember(result?.data || {}),
  };
}

export async function deleteWxRoomMember(id: number) {
  const result = await requestJson('/v1/wx_room_user/delete_by_id', {
    body: JSON.stringify({ id }),
    method: 'POST',
  });
  return result?.msg || '删除成功';
}
