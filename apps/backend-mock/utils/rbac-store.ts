import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export interface RbacPermission {
  category: string;
  code: string;
  label: string;
}

export interface RbacGroup {
  description?: string;
  id: number;
  name: string;
  permissions: string[];
  readonly?: boolean;
}

export interface RbacUser {
  enabled: boolean;
  groupId: number;
  homePath?: string;
  id: number;
  password: string;
  realName: string;
  roles: string[];
  username: string;
}

export interface OperationLogItem {
  action: string;
  createdAt: string;
  detailJson: string;
  id: number;
  page: string;
  role: string;
  username: string;
}

const RBAC_PERMISSIONS: RbacPermission[] = [
  { category: '概览', code: 'MX_DASHBOARD_VIEW', label: '查看概览' },
  { category: '麦序群列表', code: 'MX_ROOM_VIEW', label: '查看群列表' },
  { category: '麦序群列表', code: 'MX_ROOM_EDIT', label: '编辑群配置/状态' },
  { category: '群成员', code: 'MX_MEMBER_VIEW', label: '查看群成员' },
  { category: '群成员', code: 'MX_MEMBER_EDIT', label: '编辑群成员' },
  { category: '麦序查询', code: 'MX_ORDER_VIEW', label: '查看麦序查询' },
  { category: '麦序查询', code: 'MX_ORDER_EDIT', label: '编辑麦序记录' },
  { category: '关键词统计', code: 'MX_KEYWORD_VIEW', label: '查看关键词统计' },
  { category: '关键词统计', code: 'MX_KEYWORD_EDIT', label: '编辑关键词统计' },
  { category: '置顶卡设置', code: 'MX_TOP_VIEW', label: '查看置顶卡设置' },
  { category: '置顶卡设置', code: 'MX_TOP_EDIT', label: '编辑置顶卡设置' },
  { category: '系统配置', code: 'MX_RBAC_VIEW', label: '查看权限分组管理' },
  { category: '系统配置', code: 'MX_RBAC_EDIT', label: '编辑权限分组管理' },
  { category: '系统配置', code: 'MX_OPLOG_VIEW', label: '查看操作日志' },
  { category: '系统配置', code: 'MX_OPLOG_EDIT', label: '编辑操作日志' },
];

const VIEW_ONLY_CODES = [
  'MX_DASHBOARD_VIEW',
  'MX_ROOM_VIEW',
  'MX_MEMBER_VIEW',
  'MX_ORDER_VIEW',
  'MX_KEYWORD_VIEW',
  'MX_TOP_VIEW',
  'MX_OPLOG_VIEW',
];

const EDITOR_CODES = [
  ...VIEW_ONLY_CODES,
  'MX_ROOM_EDIT',
  'MX_MEMBER_EDIT',
  'MX_ORDER_EDIT',
  'MX_KEYWORD_EDIT',
  'MX_TOP_EDIT',
];

const ALL_CODES = RBAC_PERMISSIONS.map((item) => item.code);

const DB_FILE = fileURLToPath(new URL('../.data/rbac.sqlite', import.meta.url));
if (!existsSync(dirname(DB_FILE))) {
  mkdirSync(dirname(DB_FILE), { recursive: true });
}

const db = new DatabaseSync(DB_FILE);

db.exec(`
CREATE TABLE IF NOT EXISTS rbac_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  permissions TEXT NOT NULL,
  readonly INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rbac_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  real_name TEXT NOT NULL,
  role TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  home_path TEXT NOT NULL DEFAULT '/analytics',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(group_id) REFERENCES rbac_groups(id)
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  page TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

function nowText() {
  const date = new Date();
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toSafePermissions(value: unknown) {
  const valid = new Set(RBAC_PERMISSIONS.map((item) => item.code));
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter((item) => item && valid.has(item)),
    ),
  );
}

function parsePermissions(value: string) {
  try {
    return toSafePermissions(JSON.parse(value));
  } catch {
    return [];
  }
}

function seedDefaults() {
  const groupCount = Number(
    db.prepare('SELECT COUNT(1) as count FROM rbac_groups').get()?.count || 0,
  );

  if (groupCount === 0) {
    const insertGroup = db.prepare(
      'INSERT INTO rbac_groups (name, description, permissions, readonly, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const now = nowText();
    insertGroup.run(
      '超级管理员组',
      '超级管理员组，拥有所有权限',
      JSON.stringify(ALL_CODES),
      1,
      now,
      now,
    );
    insertGroup.run(
      '查看权限组',
      '默认普通管理员组，仅查看权限',
      JSON.stringify(VIEW_ONLY_CODES),
      1,
      now,
      now,
    );
    insertGroup.run(
      '可修改权限组',
      '可执行常规业务编辑',
      JSON.stringify(EDITOR_CODES),
      0,
      now,
      now,
    );
  }

  const userCount = Number(
    db.prepare('SELECT COUNT(1) as count FROM rbac_users').get()?.count || 0,
  );

  if (userCount === 0) {
    const getGroupId = db.prepare('SELECT id FROM rbac_groups WHERE name = ?');
    const superGroupId = Number(getGroupId.get('超级管理员组')?.id || 1);
    const viewGroupId = Number(getGroupId.get('查看权限组')?.id || 2);

    const insertUser = db.prepare(
      'INSERT INTO rbac_users (username, password, real_name, role, group_id, enabled, home_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const now = nowText();
    insertUser.run('vben', '123456', 'Vben', 'super', superGroupId, 1, '/analytics', now, now);
    insertUser.run('admin', '123456', 'Admin', 'admin', viewGroupId, 1, '/analytics', now, now);
    insertUser.run('jack', '123456', 'Jack', 'user', viewGroupId, 1, '/analytics', now, now);
  }
}

seedDefaults();

function toSafeUser(row: any) {
  return {
    enabled: Number(row.enabled) === 1,
    groupId: Number(row.group_id),
    homePath: String(row.home_path || ""),
    id: Number(row.id),
    realName: String(row.real_name || ""),
    roles: [String(row.role)],
    username: String(row.username || ""),
  };
}

export function getPermissionDefinitions() {
  return RBAC_PERMISSIONS;
}

export function listGroups(): RbacGroup[] {
  const rows = db
    .prepare('SELECT id, name, description, permissions, readonly FROM rbac_groups ORDER BY id ASC')
    .all();

  return rows.map((row: any) => ({
    description: row.description || '',
    id: Number(row.id),
    name: row.name,
    permissions: parsePermissions(row.permissions),
    readonly: Number(row.readonly) === 1,
  }));
}

export function saveGroup(payload: Partial<RbacGroup>) {
  const name = String(payload.name || '').trim();
  if (!name) {
    throw new Error('分组名称不能为空');
  }

  const description = String(payload.description || '').trim();
  const permissions = toSafePermissions(payload.permissions || []);

  if (payload.id) {
    const existing = db.prepare('SELECT id, readonly FROM rbac_groups WHERE id = ?').get(payload.id);
    if (!existing) {
      throw new Error('分组不存在');
    }
    if (Number(existing.readonly) === 1) {
      throw new Error('系统内置分组不允许修改');
    }

    db.prepare(
      'UPDATE rbac_groups SET name = ?, description = ?, permissions = ?, updated_at = ? WHERE id = ?',
    ).run(name, description, JSON.stringify(permissions), nowText(), payload.id);

    return listGroups().find((item) => item.id === payload.id) as RbacGroup;
  }

  db.prepare(
    'INSERT INTO rbac_groups (name, description, permissions, readonly, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
  ).run(name, description, JSON.stringify(permissions), nowText(), nowText());

  const created = db.prepare('SELECT last_insert_rowid() as id').get();
  return listGroups().find((item) => item.id === Number(created?.id)) as RbacGroup;
}

export function deleteGroup(id: number) {
  const target = db.prepare('SELECT id, readonly FROM rbac_groups WHERE id = ?').get(id);
  if (!target) {
    throw new Error('分组不存在');
  }
  if (Number(target.readonly) === 1) {
    throw new Error('系统内置分组不允许删除');
  }

  const userCount = Number(
    db.prepare('SELECT COUNT(1) as count FROM rbac_users WHERE group_id = ?').get(id)?.count || 0,
  );
  if (userCount > 0) {
    throw new Error('该分组下仍有用户，无法删除');
  }

  db.prepare('DELETE FROM rbac_groups WHERE id = ?').run(id);
}

export function listUsers() {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.real_name, u.role, u.group_id, u.enabled, u.home_path, g.name as group_name
       FROM rbac_users u
       LEFT JOIN rbac_groups g ON g.id = u.group_id
       ORDER BY u.id ASC`,
    )
    .all();

  return rows.map((row: any) => ({
    enabled: Number(row.enabled) === 1,
    groupId: Number(row.group_id),
    groupName: row.group_name || '',
    homePath: String(row.home_path || ""),
    id: Number(row.id),
    realName: String(row.real_name || ""),
    roles: [String(row.role)],
    username: String(row.username || ""),
  }));
}

export function getUserByUsername(username: string): null | RbacUser {
  const row = db
    .prepare(
      'SELECT id, username, password, real_name, role, group_id, enabled, home_path FROM rbac_users WHERE username = ? LIMIT 1',
    )
    .get(username);

  if (!row) {
    return null;
  }

  return {
    enabled: Number(row.enabled) === 1,
    groupId: Number(row.group_id),
    homePath: String(row.home_path || ""),
    id: Number(row.id),
    password: String(row.password || ""),
    realName: String(row.real_name || ""),
    roles: [String(row.role)],
    username: String(row.username || ""),
  };
}

export function findAuthUser(username: string, password: string) {
  const user = getUserByUsername(username);
  if (!user) {
    return null;
  }
  if (!user.enabled || user.password !== password) {
    return null;
  }
  return user;
}

export function saveUser(payload: Partial<RbacUser>) {
  const username = String(payload.username || '').trim();
  const realName = String(payload.realName || '').trim();
  const groupId = Number(payload.groupId || 0);
  const role = String(payload.roles?.[0] || 'user');

  if (!username) {
    throw new Error('用户名不能为空');
  }
  if (!realName) {
    throw new Error('姓名不能为空');
  }
  if (!groupId) {
    throw new Error('用户组不能为空');
  }
  if (!['super', 'admin', 'user'].includes(role)) {
    throw new Error('角色不合法');
  }

  const groupExists = db.prepare('SELECT id FROM rbac_groups WHERE id = ?').get(groupId);
  if (!groupExists) {
    throw new Error('用户组不存在');
  }

  if (payload.id !== undefined && payload.id !== null) {
    const existing = db
      .prepare(
        'SELECT id, username, role, password FROM rbac_users WHERE id = ? LIMIT 1',
      )
      .get(payload.id);
    if (!existing) {
      throw new Error('用户不存在');
    }
    if (existing.role === 'super' && role !== 'super') {
      throw new Error('超级管理员账号角色不可降级');
    }

    db.prepare(
      `UPDATE rbac_users
       SET username = ?, real_name = ?, role = ?, group_id = ?, enabled = ?,
           home_path = ?, password = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      username,
      realName,
      role,
      groupId,
      payload.enabled === false ? 0 : 1,
      payload.homePath || '/analytics',
      payload.password ? String(payload.password) : existing.password,
      nowText(),
      payload.id,
    );

    return listUsers().find((item) => item.id === payload.id);
  }

  if (!payload.password) {
    throw new Error('密码不能为空');
  }

  const existed = db
    .prepare('SELECT id FROM rbac_users WHERE username = ? LIMIT 1')
    .get(username);
  if (existed) {
    throw new Error('用户名已存在');
  }

  db.prepare(
    `INSERT INTO rbac_users
     (username, password, real_name, role, group_id, enabled, home_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    username,
    String(payload.password),
    realName,
    role,
    groupId,
    payload.enabled === false ? 0 : 1,
    payload.homePath || '/analytics',
    nowText(),
    nowText(),
  );

  const createdId = Number(db.prepare('SELECT last_insert_rowid() as id').get()?.id || 0);
  return listUsers().find((item) => item.id === createdId);
}

export function deleteUser(id: number) {
  const target = db.prepare('SELECT id, role FROM rbac_users WHERE id = ?').get(id);
  if (!target) {
    throw new Error('用户不存在');
  }
  if (String(target.role) === 'super') {
    throw new Error('超级管理员账号不可删除');
  }
  db.prepare('DELETE FROM rbac_users WHERE id = ?').run(id);
}

export function getUserAccessCodes(username: string) {
  const user = getUserByUsername(username);
  if (!user) {
    return [];
  }
  if (user.roles.includes('super')) {
    return ALL_CODES;
  }

  const group = db
    .prepare('SELECT permissions FROM rbac_groups WHERE id = ? LIMIT 1')
    .get(user.groupId);
  return group ? parsePermissions(String(group.permissions || '[]')) : [];
}

export function getUserMenus(username: string) {
  const user = getUserByUsername(username);
  if (!user) {
    return [];
  }

  const codes = new Set(getUserAccessCodes(username));
  const isSuper = user.roles.includes('super');
  const has = (code: string) => isSuper || codes.has(code);

  const maixuChildren: any[] = [];
  if (has('MX_ROOM_VIEW')) {
    maixuChildren.push({
      component: '/maixu/group-list/index',
      meta: { affixTab: false, title: '麦序群列表' },
      name: 'MaixuGroupList',
      path: '/maixu/group-list',
    });
  }
  if (has('MX_ORDER_VIEW')) {
    maixuChildren.push({
      component: '/maixu/order-query/index',
      meta: { affixTab: false, title: '麦序查询' },
      name: 'MaixuOrderQuery',
      path: '/maixu/order-query',
    });
  }
  if (has('MX_KEYWORD_VIEW')) {
    maixuChildren.push({
      component: '/maixu/keyword-stat/index',
      meta: { affixTab: false, title: '关键字统计' },
      name: 'MaixuKeywordStat',
      path: '/maixu/keyword-stat',
    });
  }
  if (has('MX_TOP_VIEW')) {
    maixuChildren.push({
      component: '/maixu/top-card/index',
      meta: { affixTab: false, title: '置顶卡设置' },
      name: 'MaixuTopCard',
      path: '/maixu/top-card',
    });
  }

  const systemChildren: any[] = [];
  if (isSuper && has('MX_RBAC_VIEW')) {
    systemChildren.push({
      component: '/maixu/rbac/index',
      meta: { affixTab: false, title: '权限分组管理' },
      name: 'SystemRbac',
      path: '/system-config/rbac',
    });
  }
  if (isSuper || has('MX_OPLOG_VIEW')) {
    systemChildren.push({
      component: '/system-config/operation-log/index',
      meta: { affixTab: false, title: '操作日志' },
      name: 'SystemOperationLog',
      path: '/system-config/operation-log',
    });
  }

  const menus: any[] = [];
  if (has('MX_DASHBOARD_VIEW')) {
    menus.push({
      meta: {
        icon: 'lucide:layout-dashboard',
        order: -1,
        title: '概览',
      },
      name: 'Dashboard',
      path: '/dashboard',
      redirect: '/analytics',
      children: [
        {
          component: '/dashboard/analytics/index',
          meta: {
            affixTab: true,
            title: '概览',
          },
          name: 'Analytics',
          path: '/analytics',
        },
      ],
    });
  }

  if (maixuChildren.length > 0) {
    menus.push({
      meta: {
        icon: 'solar:microphone-2-bold-duotone',
        order: 20,
        title: '麦序机器人',
      },
      name: 'Maixu',
      path: '/maixu',
      redirect: maixuChildren[0]?.path || '/maixu/group-list',
      children: maixuChildren,
    });
  }

  if (systemChildren.length > 0) {
    menus.push({
      meta: {
        icon: 'carbon:settings',
        order: 30,
        title: '系统配置',
      },
      name: 'SystemConfig',
      path: '/system-config',
      redirect: systemChildren[0]?.path || '/system-config/operation-log',
      children: systemChildren,
    });
  }

  return menus;
}

export function appendOperationLog(payload: {
  action: string;
  detailJson: string;
  page: string;
  role: string;
  username: string;
}) {
  db.prepare(
    'INSERT INTO operation_logs (username, role, page, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    payload.username,
    payload.role,
    payload.page,
    payload.action,
    payload.detailJson,
    nowText(),
  );
}

export function listOperationLogs(query: {
  action?: string;
  end?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  pageName?: string;
  start?: string;
  username?: string;
}) {
  const where: string[] = [];
  const params: any[] = [];

  if (query.username) {
    where.push('username = ?');
    params.push(query.username);
  }
  if (query.pageName) {
    where.push('page LIKE ?');
    params.push(`%${query.pageName}%`);
  }
  if (query.action) {
    where.push('action LIKE ?');
    params.push(`%${query.action}%`);
  }
  if (query.start) {
    where.push('created_at >= ?');
    params.push(query.start);
  }
  if (query.end) {
    where.push('created_at <= ?');
    params.push(query.end);
  }
  if (query.keyword) {
    where.push('(username LIKE ? OR page LIKE ? OR action LIKE ? OR detail_json LIKE ?)');
    const keyword = `%${query.keyword}%`;
    params.push(keyword, keyword, keyword, keyword);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const total = Number(
    db
      .prepare(`SELECT COUNT(1) as count FROM operation_logs ${whereClause}`)
      .get(...params)?.count || 0,
  );

  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.max(1, Math.min(200, Number(query.pageSize || 20)));
  const offset = (page - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT id, username, role, page, action, detail_json, created_at
       FROM operation_logs
       ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset);

  const list: OperationLogItem[] = rows.map((row: any) => ({
    action: row.action,
    createdAt: row.created_at,
    detailJson: row.detail_json,
    id: Number(row.id),
    page: row.page,
    role: row.role,
    username: String(row.username || ""),
  }));

  return { list, page, pageSize, total };
}

export function saveOperationLog(
  id: null | number,
  payload: { action: string; detailJson: string; page: string; role: string; username: string },
) {
  if (!payload.username || !payload.page || !payload.action) {
    throw new Error('username/page/action 不能为空');
  }

  if (id) {
    const existing = db.prepare('SELECT id FROM operation_logs WHERE id = ?').get(id);
    if (!existing) {
      throw new Error('日志不存在');
    }
    db.prepare(
      'UPDATE operation_logs SET username = ?, role = ?, page = ?, action = ?, detail_json = ? WHERE id = ?',
    ).run(
      payload.username,
      payload.role,
      payload.page,
      payload.action,
      payload.detailJson,
      id,
    );
    return id;
  }

  db.prepare(
    'INSERT INTO operation_logs (username, role, page, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    payload.username,
    payload.role,
    payload.page,
    payload.action,
    payload.detailJson,
    nowText(),
  );

  return Number(db.prepare('SELECT last_insert_rowid() as id').get()?.id || 0);
}

export function deleteOperationLog(id: number) {
  const existing = db.prepare('SELECT id FROM operation_logs WHERE id = ?').get(id);
  if (!existing) {
    throw new Error('日志不存在');
  }
  db.prepare('DELETE FROM operation_logs WHERE id = ?').run(id);
}
