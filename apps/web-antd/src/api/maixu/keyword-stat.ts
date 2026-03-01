export interface KeywordStatRecord {
  date: string;
  id: number;
  tag_home_people: string;
  tag_hour: number;
  tag_num: number;
  tag_one: string;
  tag_one_name: string;
  tag_room: string;
  tag_type: string;
  update_time: string;
}

export interface KeywordStatQueryParams {
  date?: string;
  end?: string;
  keywordFields?: string[];
  keywords?: string[];
  page?: number;
  pageSize?: number;
  roomWxid: string;
  start?: string;
  tagType?: string;
}

export interface KeywordStatQueryResult {
  list: KeywordStatRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface KeywordStatSavePayload {
  date: string;
  id?: number;
  tag_home_people: string;
  tag_hour: number;
  tag_num: number;
  tag_one: string;
  tag_room: string;
  tag_type: string;
  update_time?: string;
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

function normalizeRecord(value: any): KeywordStatRecord {
  return {
    date: String(value?.date ?? ''),
    id: Number(value?.id ?? 0),
    tag_home_people: String(value?.tag_home_people ?? ''),
    tag_hour: Number(value?.tag_hour ?? 0),
    tag_num: Number(value?.tag_num ?? 0),
    tag_one: String(value?.tag_one ?? ''),
    tag_one_name: String(value?.tag_one_name ?? value?.tag_one ?? ''),
    tag_room: String(value?.tag_room ?? ''),
    tag_type: String(value?.tag_type ?? ''),
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

export async function queryKeywordStats(params: KeywordStatQueryParams) {
  const result = await requestJson('/v1/tag_total/query_stats?admin=true', {
    body: JSON.stringify({
      date: params.date,
      end: params.end,
      keyword_fields: params.keywordFields ?? [],
      keywords: params.keywords ?? [],
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      start: params.start,
      tag_room: params.roomWxid,
      tag_type: params.tagType,
    }),
    method: 'POST',
  });

  const data = (result && result.data) || {};
  return {
    list: Array.isArray(data.list) ? data.list.map(normalizeRecord) : [],
    page: Number(data.page || 1),
    pageSize: Number(data.page_size || 20),
    total: Number(data.total || 0),
  } as KeywordStatQueryResult;
}

export async function saveKeywordStat(payload: KeywordStatSavePayload) {
  const path = payload.id
    ? '/v1/tag_total/update_by_id?admin=true'
    : '/v1/tag_total/upsert?admin=true';

  const result = await requestJson(path, {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  return {
    msg: result?.msg || '保存成功',
    record: normalizeRecord(result?.data || {}),
  };
}

export async function deleteKeywordStatById(id: number) {
  const result = await requestJson('/v1/tag_total/delete_by_id?admin=true', {
    body: JSON.stringify({ id }),
    method: 'POST',
  });

  return result?.msg || '删除成功';
}

export async function exportKeywordStatsExcel(params: KeywordStatQueryParams) {
  const response = await fetch(`${getApiBaseUrl()}/v1/tag_total/export_excel?admin=true`, {
    body: JSON.stringify({
      date: params.date,
      end: params.end,
      keyword_fields: params.keywordFields ?? [],
      keywords: params.keywords ?? [],
      start: params.start,
      tag_room: params.roomWxid,
      tag_type: params.tagType,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
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

  let rawName = 'keyword_stats_export.xlsx';
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
