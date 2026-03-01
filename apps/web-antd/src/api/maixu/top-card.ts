import { fetchMaixu } from './request';

export interface TopCardRecord {
  alan_name: string;
  alan_wxid: string;
  expire_time: string;
  give_name: string;
  give_wxid: string;
  id: number;
  register_name: string;
  register_wxid: string;
  remind_num: number;
  room_name: string;
  room_wxid: string;
  top_type: string;
  update_time: string;
}

export interface TopCardQueryParams {
  end?: string;
  keywordFields?: string[];
  keywords?: string[];
  page?: number;
  pageSize?: number;
  roomWxid: string;
  start?: string;
  topType?: string;
}

export interface TopCardQueryResult {
  list: TopCardRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TopCardSavePayload {
  alan_wxid: string;
  expire_time?: string;
  give_wxid: string;
  id?: number;
  register_wxid: string;
  remind_num: number;
  room_name: string;
  room_wxid: string;
  top_type: string;
  update_time?: string;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeRecord(value: any): TopCardRecord {
  return {
    alan_name: String(value?.alan_name ?? value?.alan_wxid ?? ''),
    alan_wxid: String(value?.alan_wxid ?? ''),
    expire_time: String(value?.expire_time ?? ''),
    give_name: String(value?.give_name ?? value?.give_wxid ?? ''),
    give_wxid: String(value?.give_wxid ?? ''),
    id: Number(value?.id ?? 0),
    register_name: String(value?.register_name ?? value?.register_wxid ?? ''),
    register_wxid: String(value?.register_wxid ?? ''),
    remind_num: Number(value?.remind_num ?? 0),
    room_name: String(value?.room_name ?? ''),
    room_wxid: String(value?.room_wxid ?? ''),
    top_type: String(value?.top_type ?? ''),
    update_time: String(value?.update_time ?? ''),
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

export async function queryTopCards(params: TopCardQueryParams) {
  const result = await requestJson('/v1/room_top/query?admin=true', {
    body: JSON.stringify({
      end: params.end,
      keyword_fields: params.keywordFields ?? [],
      keywords: params.keywords ?? [],
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      room_wxid: params.roomWxid,
      start: params.start,
      top_type: params.topType,
    }),
    method: 'POST',
  });

  const data = (result && result.data) || {};
  return {
    list: Array.isArray(data.list) ? data.list.map(normalizeRecord) : [],
    page: Number(data.page || 1),
    pageSize: Number(data.page_size || 20),
    total: Number(data.total || 0),
  } as TopCardQueryResult;
}

export async function saveTopCard(payload: TopCardSavePayload) {
  const path = payload.id
    ? '/v1/room_top/update_by_id?admin=true'
    : '/v1/room_top/create?admin=true';

  const result = await requestJson(path, {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return {
    msg: result?.msg || '保存成功',
    record: normalizeRecord(result?.data || {}),
  };
}

export async function deleteTopCardById(id: number) {
  const result = await requestJson('/v1/room_top/delete_by_id?admin=true', {
    body: JSON.stringify({ id }),
    method: 'POST',
  });

  return result?.msg || '删除成功';
}

export async function exportTopCardsExcel(params: TopCardQueryParams) {
  const response = await fetchMaixu('/v1/room_top/export_excel?admin=true', {
    body: JSON.stringify({
      end: params.end,
      keyword_fields: params.keywordFields ?? [],
      keywords: params.keywords ?? [],
      room_wxid: params.roomWxid,
      start: params.start,
      top_type: params.topType,
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

  let rawName = 'top_cards_export.xlsx';
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
