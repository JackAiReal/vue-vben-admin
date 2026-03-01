import { fetchMaixu } from './request';

export interface RoomOrderRecord {
  id: number;
  room_name: string;
  room_wxid: string;
  time_hour: string;
  type: string;
  date: string;
  update_time: string;
  wx_names: string[];
  wxids: string[];
  wxids_text?: string;
}

export interface QueryRoomOrderParams {
  date?: string;
  end?: string;
  keywordFields?: string[];
  keywords?: string[];
  page?: number;
  pageSize?: number;
  roomWxid: string;
  start?: string;
  type?: string;
}

export interface QueryRoomOrderResult {
  list: RoomOrderRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UpsertRoomOrderPayload {
  date: string;
  room_name: string;
  room_wxid: string;
  time_hour: string;
  type: string;
  update_time?: string;
  wxids: string[];
}

export interface UpdateRoomOrderPayload {
  date?: string;
  id: number;
  room_name?: string;
  room_wxid?: string;
  time_hour?: string;
  type?: string;
  update_time?: string;
  wxids?: string[];
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeWxids(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch {
      return value
        .replace('，', ',')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function decodeEscapedText(text: string) {
  if (!text) {
    return '';
  }
  try {
    return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
  } catch {
    return text;
  }
}

function normalizeRecord(value: any): RoomOrderRecord {
  const wxidsTextRaw =
    typeof value?.wxids_text === 'string' ? value.wxids_text : undefined;

  return {
    id: Number(value?.id ?? 0),
    room_name: String(value?.room_name ?? ''),
    room_wxid: String(value?.room_wxid ?? ''),
    time_hour: String(value?.time_hour ?? ''),
    type: String(value?.type ?? ''),
    date: String(value?.date ?? ''),
    update_time: String(value?.update_time ?? ''),
    wx_names: normalizeWxids(value?.wx_names),
    wxids: normalizeWxids(value?.wxids),
    wxids_text: wxidsTextRaw ? decodeEscapedText(wxidsTextRaw) : undefined,
  };
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetchMaixu(path, init);

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

export async function queryRoomOrders(params: QueryRoomOrderParams) {
  const payload = {
    date: params.date,
    end: params.end,
    keyword_fields: params.keywordFields ?? [],
    keywords: params.keywords ?? [],
    page: params.page ?? 1,
    page_size: params.pageSize ?? 20,
    room_wxid: params.roomWxid,
    start: params.start,
    type: params.type,
  };

  const result = await requestJson('/v1/room_list/query?admin=true', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  const data = (result && result.data) || {};
  return {
    list: Array.isArray(data.list) ? data.list.map(normalizeRecord) : [],
    page: Number(data.page || 1),
    pageSize: Number(data.page_size || 20),
    total: Number(data.total || 0),
  } as QueryRoomOrderResult;
}

export async function upsertRoomOrder(payload: UpsertRoomOrderPayload) {
  const result = await requestJson('/v1/room_list/upsert?admin=true', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return {
    msg: result?.msg || '操作成功',
    record: normalizeRecord(result?.data || {}),
  };
}

export async function updateRoomOrderById(payload: UpdateRoomOrderPayload) {
  const result = await requestJson('/v1/room_list/update_by_id?admin=true', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return {
    msg: result?.msg || '更新成功',
    record: normalizeRecord(result?.data || {}),
  };
}

export async function deleteRoomOrderById(id: number) {
  const result = await requestJson('/v1/room_list/delete_by_id?admin=true', {
    body: JSON.stringify({ id }),
    method: 'POST',
  });
  return result?.msg || '删除成功';
}

export async function exportRoomOrdersExcel(params: QueryRoomOrderParams) {
  const response = await fetchMaixu('/v1/room_list/export_excel?admin=true', {
    body: JSON.stringify({
      date: params.date,
      end: params.end,
      keyword_fields: params.keywordFields ?? [],
      keywords: params.keywords ?? [],
      room_wxid: params.roomWxid,
      start: params.start,
      type: params.type,
    }),
    method: 'POST',
  });

  if (!response.ok) {
    const text = await response.text();
    const parsed = text ? safeJsonParse(text) : null;
    const message =
      (parsed && (parsed.msg || parsed.message || parsed.error)) ||
      `导出失败(${response.status})`;
    throw new Error(String(message));
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';

  const utf8Match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename\s*=\s*"?([^";]+)"?/i);

  const encodedName = utf8Match?.[1] ? utf8Match[1].trim() : '';
  const plainName = plainMatch?.[1] ? plainMatch[1].trim() : '';

  let rawName = 'room_order_export.xlsx';
  if (encodedName) {
    try {
      rawName = decodeURIComponent(encodedName);
    } catch {
      rawName = encodedName;
    }
  } else if (plainName) {
    rawName = plainName;
  }

  return { blob, filename: rawName };
}
