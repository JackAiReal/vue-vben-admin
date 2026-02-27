export interface MaixuRoomConfig {
  [key: string]: any;
}

export interface MaixuRoomItem {
  id?: number;
  room_name: string;
  room_wxid: string;
  room_config: MaixuRoomConfig;
  update_time: string;
  status?: number;
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

function normalizeRoom(value: any): MaixuRoomItem {
  return {
    id: value?.id,
    room_name: String(value?.room_name ?? ''),
    room_wxid: String(value?.room_wxid ?? ''),
    room_config: normalizeRoomConfig(value?.room_config),
    update_time: String(value?.update_time ?? ''),
    status: typeof value?.status === 'number' ? value.status : undefined,
  };
}

function sortRoomsByUpdateTimeDesc(rooms: MaixuRoomItem[]) {
  return [...rooms].sort((left, right) => {
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
      ...(init?.headers ?? {}),
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

  return normalizeRoom(raw);
}

export async function updateMaixuRoomConfigItem(
  roomWxid: string,
  item: string,
  value: unknown,
) {
  const query = new URLSearchParams({
    admin: 'true',
    room_wxid: roomWxid,
  });

  const raw = await requestJson(`/v1/room_super/update_item?${query.toString()}`, {
    body: JSON.stringify({ item, value }),
    method: 'POST',
  });

  return normalizeRoom(raw);
}
