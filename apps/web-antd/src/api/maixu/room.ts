export interface MaixuRoomConfig {
  [key: string]: any;
}

export interface MaixuRoomItem {
  id?: number;
  room_name: string;
  room_wxid: string;
  room_config: MaixuRoomConfig;
  status?: number;
  update_time: string;
}

export interface UpdateRoomConfigPayload {
  room_config: MaixuRoomConfig;
  room_name: string;
  room_wxid: string;
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

function safeParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function tryDecodeBase64Json(raw: string) {
  if (typeof atob !== 'function') {
    return null;
  }
  try {
    const decoded = atob(raw);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function normalizeRoomConfig(value: unknown): MaixuRoomConfig {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as MaixuRoomConfig;
  }

  if (typeof value === 'string') {
    const parsed = safeParseJson(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as MaixuRoomConfig;
    }
  }

  return {};
}

function unwrapRoomPayload(raw: any) {
  let value = raw;
  if (typeof value === 'string') {
    value = safeParseJson(value) ?? tryDecodeBase64Json(value) ?? value;
  }

  if (
    value &&
    typeof value === 'object' &&
    value.data &&
    typeof value.data === 'object'
  ) {
    return value.data;
  }

  return value;
}

function cleanText(value: unknown) {
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

function normalizeTextValue(value: unknown, fallback = '') {
  const cleaned = cleanText(value);
  if (cleaned) {
    return cleaned;
  }
  return cleanText(fallback);
}

function normalizeRoom(
  value: any,
  fallback: Partial<MaixuRoomItem> = {},
): MaixuRoomItem {
  let status: number | undefined;
  if (typeof value?.status === 'number') {
    status = value.status;
  } else if (typeof fallback.status === 'number') {
    status = fallback.status;
  }

  return {
    id: value?.id ?? fallback.id,
    room_name: normalizeTextValue(value?.room_name, fallback.room_name),
    room_wxid: normalizeTextValue(value?.room_wxid, fallback.room_wxid),
    room_config: normalizeRoomConfig(
      value?.room_config ?? fallback.room_config,
    ),
    status,
    update_time: normalizeTextValue(value?.update_time, fallback.update_time),
  };
}

function sortRoomsByUpdateTimeDesc(rooms: MaixuRoomItem[]) {
  return rooms.toSorted((left, right) => {
    const leftTime = Date.parse(left.update_time.replace(' ', 'T')) || 0;
    const rightTime = Date.parse(right.update_time.replace(' ', 'T')) || 0;
    return rightTime - leftTime;
  });
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const message =
      (parsed && (parsed.msg || parsed.message || parsed.error)) ||
      `请求失败(${response.status})`;
    throw new Error(String(message));
  }

  return parsed ?? text;
}

export async function fetchMaixuRooms() {
  const raw = await requestJson('/v1/room_super/find_all_room?admin=true', {
    method: 'POST',
  });

  const list = Array.isArray(raw) ? raw : [];
  return sortRoomsByUpdateTimeDesc(list.map((item) => normalizeRoom(item)));
}

export async function updateMaixuRoomConfig(payload: UpdateRoomConfigPayload) {
  const raw = await requestJson('/v1/room_super/update_all_config', {
    body: JSON.stringify(payload),
    method: 'POST',
  });

  const roomPayload = unwrapRoomPayload(raw);
  return normalizeRoom(roomPayload, {
    room_config: payload.room_config,
    room_name: payload.room_name,
    room_wxid: payload.room_wxid,
  });
}

export async function updateMaixuRoomConfigItem(
  roomWxid: string,
  item: string,
  value: unknown,
  fallback?: Partial<MaixuRoomItem>,
) {
  const query = new URLSearchParams({
    admin: 'true',
    room_wxid: roomWxid,
  });

  const raw = await requestJson(
    `/v1/room_super/update_item?${query.toString()}`,
    {
      body: JSON.stringify({ item, value }),
      method: 'POST',
    },
  );

  const roomPayload = unwrapRoomPayload(raw);
  return normalizeRoom(roomPayload, {
    ...fallback,
    room_wxid: roomWxid,
  });
}
