import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export interface MaixuUserBinding {
  createdAt: string;
  roomName: string;
  roomWxid: string;
  sourceWxid: string;
  updatedAt: string;
  username: string;
}

const DB_FILE = fileURLToPath(
  new URL('../.data/maixu-user.sqlite', import.meta.url),
);
if (!existsSync(dirname(DB_FILE))) {
  mkdirSync(dirname(DB_FILE), { recursive: true });
}

const db = new DatabaseSync(DB_FILE);

db.exec(`
CREATE TABLE IF NOT EXISTS maixu_bind_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bind_code TEXT NOT NULL,
  room_wxid TEXT NOT NULL,
  room_name TEXT NOT NULL DEFAULT '',
  source_wxid TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  consumed_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  consumed_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS maixu_user_room_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  room_wxid TEXT NOT NULL,
  room_name TEXT NOT NULL DEFAULT '',
  source_wxid TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(username, room_wxid)
);
`);

db.exec(
  'CREATE INDEX IF NOT EXISTS idx_maixu_bind_codes_code ON maixu_bind_codes(bind_code)',
);
db.exec(
  'CREATE INDEX IF NOT EXISTS idx_maixu_bind_codes_expires ON maixu_bind_codes(expires_at)',
);
db.exec(
  'CREATE INDEX IF NOT EXISTS idx_maixu_user_room_bindings_username ON maixu_user_room_bindings(username)',
);

function normalizeRoomText(value: unknown) {
  return String(value || '')
    .replaceAll(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function nowText(date = new Date()) {
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseDateText(value: string) {
  return Date.parse(value.replace(' ', 'T'));
}

function formatDateByMinutes(minutes: number) {
  const clamped = Math.max(1, Math.min(30, Math.floor(minutes)));
  return nowText(new Date(Date.now() + clamped * 60 * 1000));
}

function randomDigits(length = 6) {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += `${Math.floor(Math.random() * 10)}`;
  }
  return code;
}

function toBinding(row: any): MaixuUserBinding {
  return {
    createdAt: String(row.created_at || ''),
    roomName: String(row.room_name || ''),
    roomWxid: String(row.room_wxid || ''),
    sourceWxid: String(row.source_wxid || ''),
    updatedAt: String(row.updated_at || ''),
    username: String(row.username || ''),
  };
}

export function createMaixuBindCode(payload: {
  minutes?: number;
  roomName?: string;
  roomWxid: string;
  sourceWxid?: string;
}) {
  const roomWxid = normalizeRoomText(payload.roomWxid);
  if (!roomWxid) {
    throw new Error('roomWxid 不能为空');
  }

  const roomName = normalizeRoomText(payload.roomName);
  const sourceWxid = normalizeRoomText(payload.sourceWxid);
  const expiresAt = formatDateByMinutes(Number(payload.minutes || 10));

  const now = nowText();
  let bindCode = '';
  for (let index = 0; index < 20; index += 1) {
    const candidate = randomDigits(6);
    const exists = db
      .prepare(
        'SELECT id FROM maixu_bind_codes WHERE bind_code = ? AND consumed = 0 AND expires_at >= ? LIMIT 1',
      )
      .get(candidate, now);
    if (!exists) {
      bindCode = candidate;
      break;
    }
  }

  if (!bindCode) {
    throw new Error('生成验证码失败，请稍后重试');
  }

  db.prepare(
    `INSERT INTO maixu_bind_codes
      (bind_code, room_wxid, room_name, source_wxid, expires_at, consumed, consumed_by, created_at, consumed_at)
      VALUES (?, ?, ?, ?, ?, 0, '', ?, '')`,
  ).run(bindCode, roomWxid, roomName, sourceWxid, expiresAt, now);

  return {
    bindCode,
    expiresAt,
    roomName,
    roomWxid,
  };
}

export function consumeMaixuBindCode(username: string, code: string) {
  const normalizedUsername = normalizeRoomText(username);
  const normalizedCode = normalizeRoomText(code);

  if (!normalizedUsername) {
    throw new Error('username 不能为空');
  }
  if (!/^\d{4,8}$/.test(normalizedCode)) {
    throw new Error('验证码格式不正确');
  }

  const row = db
    .prepare(
      `SELECT id, bind_code, room_wxid, room_name, source_wxid,
              expires_at, consumed, consumed_by
       FROM maixu_bind_codes
       WHERE bind_code = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(normalizedCode);

  if (!row) {
    throw new Error('验证码不存在');
  }
  if (Number(row.consumed) === 1) {
    if (String(row.consumed_by || '') === normalizedUsername) {
      throw new Error('该验证码已绑定过');
    }
    throw new Error('该验证码已被使用');
  }

  const expiresAt = String(row.expires_at || '');
  const expiresTime = parseDateText(expiresAt);
  if (Number.isNaN(expiresTime) || expiresTime < Date.now()) {
    throw new Error('验证码已过期');
  }

  const now = nowText();
  const roomWxid = normalizeRoomText(row.room_wxid);
  if (!roomWxid) {
    throw new Error('绑定数据异常，缺少 roomWxid');
  }

  db.prepare(
    'UPDATE maixu_bind_codes SET consumed = 1, consumed_by = ?, consumed_at = ? WHERE id = ?',
  ).run(normalizedUsername, now, row.id);

  const existing = db
    .prepare(
      'SELECT id FROM maixu_user_room_bindings WHERE username = ? AND room_wxid = ? LIMIT 1',
    )
    .get(normalizedUsername, roomWxid);

  const roomName = normalizeRoomText(row.room_name);
  const sourceWxid = normalizeRoomText(row.source_wxid);

  if (existing?.id) {
    db.prepare(
      `UPDATE maixu_user_room_bindings
       SET room_name = ?, source_wxid = ?, updated_at = ?
       WHERE id = ?`,
    ).run(roomName, sourceWxid, now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO maixu_user_room_bindings
        (username, room_wxid, room_name, source_wxid, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(normalizedUsername, roomWxid, roomName, sourceWxid, now, now);
  }

  return {
    expiresAt,
    roomName,
    roomWxid,
    sourceWxid,
    username: normalizedUsername,
  };
}

export function listMaixuUserBindings(username: string) {
  const normalizedUsername = normalizeRoomText(username);
  if (!normalizedUsername) {
    return [];
  }

  const rows = db
    .prepare(
      `SELECT username, room_wxid, room_name, source_wxid, created_at, updated_at
       FROM maixu_user_room_bindings
       WHERE username = ?
       ORDER BY updated_at DESC, id DESC`,
    )
    .all(normalizedUsername);

  return rows.map(toBinding);
}

export function deleteMaixuUserBinding(username: string, roomWxid: string) {
  const normalizedUsername = normalizeRoomText(username);
  const normalizedRoomWxid = normalizeRoomText(roomWxid);

  if (!normalizedUsername || !normalizedRoomWxid) {
    throw new Error('username/roomWxid 不能为空');
  }

  const existing = db
    .prepare(
      'SELECT id FROM maixu_user_room_bindings WHERE username = ? AND room_wxid = ? LIMIT 1',
    )
    .get(normalizedUsername, normalizedRoomWxid);

  if (!existing?.id) {
    throw new Error('绑定关系不存在');
  }

  db.prepare('DELETE FROM maixu_user_room_bindings WHERE id = ?').run(
    existing.id,
  );
}
