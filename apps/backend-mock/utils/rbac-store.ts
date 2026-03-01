import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export interface RbacPermission {
  category: string;
  code: string;
  hidden?: boolean;
  label: string;
  menuGroup?: string;
  order?: number;
}

export interface RbacGroup {
  description?: string;
  id: number;
  name: string;
  permissions: string[];
  readonly?: boolean;
}

export interface RbacUser {
  email?: string;
  enabled: boolean;
  groupId: number;
  homePath?: string;
  id: number;
  password: string;
  realName: string;
  roles: string[];
  username: string;
}

export interface NotificationSettings {
  approvalBodyTemplate: string;
  approvalSubjectTemplate: string;
  bodyTemplate: string;
  configured: boolean;
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPassword: string;
  smtpPort: number;
  smtpUsername: string;
  subjectTemplate: string;
  useSSL: boolean;
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

export type SystemLogLevel = 'error' | 'info' | 'warn';

export interface SystemLogItem {
  createdAt: string;
  detailJson: string;
  id: number;
  level: SystemLogLevel;
  message: string;
  source: string;
  username: string;
}

const RBAC_PERMISSIONS: RbacPermission[] = [
  {
    category: '左侧菜单',
    code: 'MX_DASHBOARD_VIEW',
    label: '概览 / 概览',
    menuGroup: '概览',
    order: 10,
  },

  {
    category: '左侧菜单',
    code: 'MX_ROOM_VIEW',
    label: '麦序机器人 / 群列表',
    menuGroup: '麦序机器人',
    order: 20,
  },
  {
    category: '左侧菜单',
    code: 'MX_ORDER_VIEW',
    label: '麦序机器人 / 麦序查询',
    menuGroup: '麦序机器人',
    order: 21,
  },
  {
    category: '左侧菜单',
    code: 'MX_KEYWORD_VIEW',
    label: '麦序机器人 / 关键字统计',
    menuGroup: '麦序机器人',
    order: 22,
  },
  {
    category: '左侧菜单',
    code: 'MX_TOP_VIEW',
    label: '麦序机器人 / 置顶卡设置',
    menuGroup: '麦序机器人',
    order: 23,
  },

  {
    category: '左侧菜单',
    code: 'MX_USER_GROUP_VIEW',
    label: '麦序机器人-用户 / 群列表',
    menuGroup: '麦序机器人-用户',
    order: 30,
  },
  {
    category: '左侧菜单',
    code: 'MX_USER_ORDER_VIEW',
    label: '麦序机器人-用户 / 麦序记录',
    menuGroup: '麦序机器人-用户',
    order: 31,
  },
  {
    category: '左侧菜单',
    code: 'MX_USER_KEYWORD_VIEW',
    label: '麦序机器人-用户 / 关键字统计',
    menuGroup: '麦序机器人-用户',
    order: 32,
  },
  {
    category: '左侧菜单',
    code: 'MX_USER_TOP_VIEW',
    label: '麦序机器人-用户 / 置顶卡设置',
    menuGroup: '麦序机器人-用户',
    order: 33,
  },

  {
    category: '左侧菜单',
    code: 'MX_APPLY_SUBMIT_VIEW',
    label: '申请业务 / 提交申请',
    menuGroup: '申请业务',
    order: 40,
  },
  {
    category: '左侧菜单',
    code: 'MX_APPLY_MINE_VIEW',
    label: '申请业务 / 我的申请',
    menuGroup: '申请业务',
    order: 41,
  },
  {
    category: '左侧菜单',
    code: 'MX_APPLY_REVIEW_VIEW',
    label: '申请业务 / 我的审批',
    menuGroup: '申请业务',
    order: 42,
  },

  {
    category: '左侧菜单',
    code: 'MX_USER_VIEW',
    label: '系统配置 / 用户管理',
    menuGroup: '系统配置',
    order: 50,
  },
  {
    category: '左侧菜单',
    code: 'MX_RBAC_VIEW',
    label: '系统配置 / 权限分组管理',
    menuGroup: '系统配置',
    order: 51,
  },
  {
    category: '左侧菜单',
    code: 'MX_NOTIFY_VIEW',
    label: '系统配置 / 通知设置',
    menuGroup: '系统配置',
    order: 52,
  },
  {
    category: '左侧菜单',
    code: 'MX_OPLOG_VIEW',
    label: '系统配置 / 操作日志',
    menuGroup: '系统配置',
    order: 53,
  },
  {
    category: '左侧菜单',
    code: 'MX_SYSLOG_VIEW',
    label: '系统配置 / 系统日志',
    menuGroup: '系统配置',
    order: 54,
  },

  {
    category: '按钮权限',
    code: 'MX_ROOM_EDIT',
    label: '麦序机器人 / 群列表：编辑群配置与状态',
    menuGroup: '麦序机器人',
    order: 110,
  },
  {
    category: '按钮权限',
    code: 'MX_MEMBER_VIEW',
    label: '麦序机器人 / 群列表：查看群成员',
    menuGroup: '麦序机器人',
    order: 111,
  },
  {
    category: '按钮权限',
    code: 'MX_MEMBER_EDIT',
    label: '麦序机器人 / 群列表：编辑群成员',
    menuGroup: '麦序机器人',
    order: 112,
  },
  {
    category: '按钮权限',
    code: 'MX_ORDER_EDIT',
    label: '麦序机器人 / 麦序查询：新增、修改、删除',
    menuGroup: '麦序机器人',
    order: 113,
  },
  {
    category: '按钮权限',
    code: 'MX_KEYWORD_EDIT',
    label: '麦序机器人 / 关键字统计：新增、修改、删除',
    menuGroup: '麦序机器人',
    order: 114,
  },
  {
    category: '按钮权限',
    code: 'MX_TOP_EDIT',
    label: '麦序机器人 / 置顶卡设置：新增、修改、删除',
    menuGroup: '麦序机器人',
    order: 115,
  },

  {
    category: '按钮权限',
    code: 'MX_USER_GROUP_EDIT',
    label: '麦序机器人-用户 / 群列表：绑定、配置、暂停、删除',
    menuGroup: '麦序机器人-用户',
    order: 120,
  },
  {
    category: '按钮权限',
    code: 'MX_USER_ORDER_EDIT',
    label: '麦序机器人-用户 / 麦序记录：新增、修改、删除',
    menuGroup: '麦序机器人-用户',
    order: 121,
  },
  {
    category: '按钮权限',
    code: 'MX_USER_KEYWORD_EDIT',
    label: '麦序机器人-用户 / 关键字统计：新增、修改、删除',
    menuGroup: '麦序机器人-用户',
    order: 122,
  },
  {
    category: '按钮权限',
    code: 'MX_USER_TOP_EDIT',
    label: '麦序机器人-用户 / 置顶卡设置：新增、修改、删除',
    menuGroup: '麦序机器人-用户',
    order: 123,
  },

  {
    category: '按钮权限',
    code: 'MX_APPLY_SUBMIT_EDIT',
    label: '申请业务 / 提交申请：提交审批单',
    menuGroup: '申请业务',
    order: 130,
  },
  {
    category: '按钮权限',
    code: 'MX_APPLY_MINE_EDIT',
    label: '申请业务 / 我的申请：修改重提、撤回',
    menuGroup: '申请业务',
    order: 131,
  },
  {
    category: '按钮权限',
    code: 'MX_APPLY_REVIEW_EDIT',
    label: '申请业务 / 我的审批：同意、驳回',
    menuGroup: '申请业务',
    order: 132,
  },

  {
    category: '按钮权限',
    code: 'MX_RBAC_EDIT',
    label: '系统配置 / 权限分组管理：增删改',
    menuGroup: '系统配置',
    order: 140,
  },
  {
    category: '按钮权限',
    code: 'MX_USER_EDIT',
    label: '系统配置 / 用户管理：增删改、禁用恢复',
    menuGroup: '系统配置',
    order: 141,
  },
  {
    category: '按钮权限',
    code: 'MX_NOTIFY_EDIT',
    label: '系统配置 / 通知设置：保存与测试邮件',
    menuGroup: '系统配置',
    order: 142,
  },
  {
    category: '按钮权限',
    code: 'MX_OPLOG_EDIT',
    label: '系统配置 / 操作日志：增删改',
    menuGroup: '系统配置',
    order: 143,
  },

  {
    category: '系统兼容',
    code: 'MX_USER_ROOM_VIEW',
    hidden: true,
    label: '兼容旧版：麦序机器人-用户菜单查看',
    menuGroup: '系统兼容',
    order: 999,
  },
];

const LEGACY_VIEW_CODE_MAP: Record<string, string[]> = {
  MX_USER_ROOM_VIEW: [
    'MX_USER_GROUP_VIEW',
    'MX_USER_ORDER_VIEW',
    'MX_USER_KEYWORD_VIEW',
    'MX_USER_TOP_VIEW',
    'MX_APPLY_SUBMIT_VIEW',
    'MX_APPLY_MINE_VIEW',
    'MX_APPLY_REVIEW_VIEW',
  ],
};

const LEGACY_EDIT_CODE_MAP: Record<string, string[]> = {
  MX_KEYWORD_EDIT: ['MX_USER_KEYWORD_EDIT'],
  MX_TOP_EDIT: ['MX_USER_TOP_EDIT'],
};

const IMPLIED_VIEW_CODE_MAP: Record<string, string[]> = {
  MX_ROOM_EDIT: ['MX_ROOM_VIEW'],
  MX_MEMBER_EDIT: ['MX_MEMBER_VIEW'],
  MX_ORDER_EDIT: ['MX_ORDER_VIEW'],
  MX_KEYWORD_EDIT: ['MX_KEYWORD_VIEW'],
  MX_TOP_EDIT: ['MX_TOP_VIEW'],
  MX_USER_GROUP_EDIT: ['MX_USER_GROUP_VIEW'],
  MX_USER_ORDER_EDIT: ['MX_USER_ORDER_VIEW'],
  MX_USER_KEYWORD_EDIT: ['MX_USER_KEYWORD_VIEW'],
  MX_USER_TOP_EDIT: ['MX_USER_TOP_VIEW'],
  MX_APPLY_SUBMIT_EDIT: ['MX_APPLY_SUBMIT_VIEW'],
  MX_APPLY_MINE_EDIT: ['MX_APPLY_MINE_VIEW'],
  MX_APPLY_REVIEW_EDIT: ['MX_APPLY_REVIEW_VIEW'],
  MX_RBAC_EDIT: ['MX_RBAC_VIEW'],
  MX_USER_EDIT: ['MX_USER_VIEW'],
  MX_NOTIFY_EDIT: ['MX_NOTIFY_VIEW'],
  MX_OPLOG_EDIT: ['MX_OPLOG_VIEW'],
};

const VIEW_ONLY_CODES = [
  'MX_DASHBOARD_VIEW',
  'MX_ROOM_VIEW',
  'MX_ORDER_VIEW',
  'MX_KEYWORD_VIEW',
  'MX_TOP_VIEW',
  'MX_USER_GROUP_VIEW',
  'MX_USER_ORDER_VIEW',
  'MX_USER_KEYWORD_VIEW',
  'MX_USER_TOP_VIEW',
  'MX_APPLY_SUBMIT_VIEW',
  'MX_APPLY_MINE_VIEW',
  'MX_APPLY_REVIEW_VIEW',
  'MX_USER_VIEW',
  'MX_RBAC_VIEW',
  'MX_NOTIFY_VIEW',
  'MX_OPLOG_VIEW',
  'MX_SYSLOG_VIEW',
  'MX_MEMBER_VIEW',
];

const EDITOR_CODES = [
  ...VIEW_ONLY_CODES,
  'MX_ROOM_EDIT',
  'MX_MEMBER_EDIT',
  'MX_ORDER_EDIT',
  'MX_KEYWORD_EDIT',
  'MX_TOP_EDIT',
  'MX_USER_GROUP_EDIT',
  'MX_USER_ORDER_EDIT',
  'MX_USER_KEYWORD_EDIT',
  'MX_USER_TOP_EDIT',
  'MX_APPLY_SUBMIT_EDIT',
  'MX_APPLY_MINE_EDIT',
  'MX_NOTIFY_EDIT',
];

const ALL_CODES = RBAC_PERMISSIONS.map((item) => item.code);

const DEFAULT_NOTIFY_SUBJECT = '【{{app_name}}】邮箱验证码';
const DEFAULT_NOTIFY_BODY = [
  '你好，',
  '',
  '你正在注册 {{app_name}} 账号，本次验证码为：{{code}}',
  '验证码 {{minutes}} 分钟内有效，请勿泄露给他人。',
  '',
  '如果不是你本人操作，请忽略此邮件。',
].join('\n');

const DEFAULT_APPROVAL_SUBJECT =
  '【审批提醒】{{type_label}}审批待处理：{{request_no}}';
const DEFAULT_APPROVAL_BODY = [
  '{{type_label}}申请{{action_text}}。',
  '',
  '审批单号：{{request_no}}',
  '申请人：{{applicant_user}}',
  '群ID：{{room_wxid}}',
  '群昵称：{{room_name}}',
  '当前过期时间：{{current_expire_time}}',
  '目标过期时间：{{target_expire_time}}',
  '申请理由：{{reason}}',
  '提交时间：{{submitted_at}}',
  '',
  '请尽快处理。若 {{approve_timeout_hours}} 小时内未处理，系统将自动同意并执行。',
].join('\n');

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
  email TEXT NOT NULL DEFAULT '',
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

CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  smtp_host TEXT NOT NULL DEFAULT '',
  smtp_port INTEGER NOT NULL DEFAULT 465,
  smtp_username TEXT NOT NULL DEFAULT '',
  smtp_password TEXT NOT NULL DEFAULT '',
  use_ssl INTEGER NOT NULL DEFAULT 1,
  from_email TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  subject_template TEXT NOT NULL DEFAULT '',
  body_template TEXT NOT NULL DEFAULT '',
  approval_subject_template TEXT NOT NULL DEFAULT '',
  approval_body_template TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene TEXT NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`);

function ensureColumn(tableName: string, columnName: string, ddl: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = rows.some((row: any) => String(row.name) === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
}

ensureColumn('rbac_users', 'email', "email TEXT NOT NULL DEFAULT ''");
ensureColumn(
  'notification_settings',
  'approval_subject_template',
  "approval_subject_template TEXT NOT NULL DEFAULT ''",
);
ensureColumn(
  'notification_settings',
  'approval_body_template',
  "approval_body_template TEXT NOT NULL DEFAULT ''",
);

db.exec('CREATE INDEX IF NOT EXISTS idx_rbac_users_email ON rbac_users(email)');
db.exec(
  'CREATE INDEX IF NOT EXISTS idx_email_codes_scene_email ON email_verification_codes(scene, email)',
);
db.exec(
  'CREATE INDEX IF NOT EXISTS idx_system_logs_level_created ON system_logs(level, created_at)',
);
db.exec(
  'CREATE INDEX IF NOT EXISTS idx_system_logs_source_created ON system_logs(source, created_at)',
);

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

  const baseCodes = [
    ...new Set(
      value
        .map((item) => String(item || '').trim())
        .filter((item) => item && valid.has(item)),
    ),
  ];

  const merged = new Set(baseCodes);
  for (const code of baseCodes) {
    for (const mappedCode of LEGACY_VIEW_CODE_MAP[code] || []) {
      if (valid.has(mappedCode)) {
        merged.add(mappedCode);
      }
    }
    for (const mappedCode of LEGACY_EDIT_CODE_MAP[code] || []) {
      if (valid.has(mappedCode)) {
        merged.add(mappedCode);
      }
    }
    for (const mappedCode of IMPLIED_VIEW_CODE_MAP[code] || []) {
      if (valid.has(mappedCode)) {
        merged.add(mappedCode);
      }
    }
  }

  return [...merged];
}

function parsePermissions(value: string) {
  try {
    return toSafePermissions(JSON.parse(value));
  } catch {
    return [];
  }
}

function normalizeEmail(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(value);
}

function isValidUsername(value: string) {
  return /^[\w\-.]{4,32}$/.test(value);
}

function formatDateByMinutes(minutes: number) {
  const date = new Date(Date.now() + Math.max(1, minutes) * 60 * 1000);
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function fillTemplate(
  template: string,
  variables: Record<string, number | string>,
) {
  return template.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
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
      'INSERT INTO rbac_users (username, email, password, real_name, role, group_id, enabled, home_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const now = nowText();
    insertUser.run(
      'vben',
      'vben@example.com',
      '123456',
      'Vben',
      'super',
      superGroupId,
      1,
      '/analytics',
      now,
      now,
    );
    insertUser.run(
      'admin',
      'admin@example.com',
      '123456',
      'Admin',
      'admin',
      viewGroupId,
      1,
      '/analytics',
      now,
      now,
    );
    insertUser.run(
      'jack',
      'jack@example.com',
      '123456',
      'Jack',
      'user',
      viewGroupId,
      1,
      '/analytics',
      now,
      now,
    );
  }

  const settingsCount = Number(
    db.prepare('SELECT COUNT(1) as count FROM notification_settings').get()
      ?.count || 0,
  );
  if (settingsCount === 0) {
    db.prepare(
      `INSERT INTO notification_settings
       (id, smtp_host, smtp_port, smtp_username, smtp_password, use_ssl, from_email, from_name, subject_template, body_template, approval_subject_template, approval_body_template, updated_at)
       VALUES (1, '', 465, '', '', 1, '', '', ?, ?, ?, ?, ?)`,
    ).run(
      DEFAULT_NOTIFY_SUBJECT,
      DEFAULT_NOTIFY_BODY,
      DEFAULT_APPROVAL_SUBJECT,
      DEFAULT_APPROVAL_BODY,
      nowText(),
    );
  }
}

function ensureBuiltinGroupPermissions() {
  const targets: Array<{ name: string; permissions: string[] }> = [
    { name: '超级管理员组', permissions: ALL_CODES },
    { name: '查看权限组', permissions: VIEW_ONLY_CODES },
    { name: '可修改权限组', permissions: EDITOR_CODES },
  ];

  for (const target of targets) {
    const row = db
      .prepare('SELECT id, permissions FROM rbac_groups WHERE name = ? LIMIT 1')
      .get(target.name);

    if (!row?.id) {
      continue;
    }

    const current = parsePermissions(String(row.permissions || '[]'));
    const merged = [...new Set([...current, ...target.permissions])];
    const noChange =
      merged.length === current.length &&
      merged.every((item) => current.includes(item));

    if (!noChange) {
      db.prepare(
        'UPDATE rbac_groups SET permissions = ?, updated_at = ? WHERE id = ?',
      ).run(JSON.stringify(merged), nowText(), row.id);
    }
  }
}

seedDefaults();
ensureBuiltinGroupPermissions();

db.exec(
  "UPDATE rbac_users SET email = username || '@example.com' WHERE email = ''",
);

function toSafeUser(row: any) {
  return {
    email: normalizeEmail(row.email),
    enabled: Number(row.enabled) === 1,
    groupId: Number(row.group_id),
    homePath: String(row.home_path || ''),
    id: Number(row.id),
    realName: String(row.real_name || ''),
    roles: [String(row.role)],
    username: String(row.username || ''),
  };
}

export function getPermissionDefinitions() {
  return RBAC_PERMISSIONS.filter((item) => !item.hidden).toSorted((a, b) => {
    const left = Number(a.order || 0);
    const right = Number(b.order || 0);
    if (left !== right) {
      return left - right;
    }
    return a.label.localeCompare(b.label, 'zh-CN');
  });
}

export function listGroups(): RbacGroup[] {
  const rows = db
    .prepare(
      'SELECT id, name, description, permissions, readonly FROM rbac_groups ORDER BY id ASC',
    )
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
    const existing = db
      .prepare('SELECT id, name, readonly FROM rbac_groups WHERE id = ?')
      .get(payload.id);
    if (!existing) {
      throw new Error('分组不存在');
    }
    if (
      Number(existing.readonly) === 1 &&
      String(existing.name) !== '查看权限组'
    ) {
      throw new Error('系统内置分组不允许修改');
    }

    db.prepare(
      'UPDATE rbac_groups SET name = ?, description = ?, permissions = ?, updated_at = ? WHERE id = ?',
    ).run(
      name,
      description,
      JSON.stringify(permissions),
      nowText(),
      payload.id,
    );

    return listGroups().find((item) => item.id === payload.id) as RbacGroup;
  }

  db.prepare(
    'INSERT INTO rbac_groups (name, description, permissions, readonly, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
  ).run(name, description, JSON.stringify(permissions), nowText(), nowText());

  const created = db.prepare('SELECT last_insert_rowid() as id').get();
  return listGroups().find(
    (item) => item.id === Number(created?.id),
  ) as RbacGroup;
}

export function deleteGroup(id: number) {
  const target = db
    .prepare('SELECT id, readonly FROM rbac_groups WHERE id = ?')
    .get(id);
  if (!target) {
    throw new Error('分组不存在');
  }
  if (Number(target.readonly) === 1) {
    throw new Error('系统内置分组不允许删除');
  }

  const userCount = Number(
    db
      .prepare('SELECT COUNT(1) as count FROM rbac_users WHERE group_id = ?')
      .get(id)?.count || 0,
  );
  if (userCount > 0) {
    throw new Error('该分组下仍有用户，无法删除');
  }

  db.prepare('DELETE FROM rbac_groups WHERE id = ?').run(id);
}

export function listUsers() {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.real_name, u.role, u.group_id, u.enabled, u.home_path, g.name as group_name
       FROM rbac_users u
       LEFT JOIN rbac_groups g ON g.id = u.group_id
       ORDER BY u.id ASC`,
    )
    .all();

  return rows.map((row: any) => ({
    ...toSafeUser(row),
    groupName: String(row.group_name || ''),
  }));
}

export function queryUsers(query: {
  enabled?: '' | 'false' | 'true';
  groupId?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
  role?: '' | 'admin' | 'super' | 'user';
}) {
  const where: string[] = [];
  const params: any[] = [];

  if (query.role) {
    where.push('u.role = ?');
    params.push(query.role);
  }

  if (query.enabled === 'false') {
    where.push('u.enabled = 0');
  } else if (query.enabled === 'true') {
    where.push('u.enabled = 1');
  }

  const groupId = Number(query.groupId || 0);
  if (groupId > 0) {
    where.push('u.group_id = ?');
    params.push(groupId);
  }

  const keyword = String(query.keyword || '').trim();
  if (keyword) {
    where.push('(u.username LIKE ? OR u.email LIKE ? OR u.real_name LIKE ?)');
    const fuzzy = `%${keyword}%`;
    params.push(fuzzy, fuzzy, fuzzy);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    db
      .prepare(`SELECT COUNT(1) as count FROM rbac_users u ${whereClause}`)
      .get(...params)?.count || 0,
  );

  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.max(1, Math.min(200, Number(query.pageSize || 20)));
  const offset = (page - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.real_name, u.role, u.group_id, u.enabled, u.home_path, g.name as group_name
       FROM rbac_users u
       LEFT JOIN rbac_groups g ON g.id = u.group_id
       ${whereClause}
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset);

  const list = rows.map((row: any) => ({
    ...toSafeUser(row),
    groupName: String(row.group_name || ''),
  }));

  return { list, page, pageSize, total };
}

export function getUserByUsername(username: string): null | RbacUser {
  const row = db
    .prepare(
      'SELECT id, username, email, password, real_name, role, group_id, enabled, home_path FROM rbac_users WHERE username = ? LIMIT 1',
    )
    .get(username);

  if (!row) {
    return null;
  }

  return {
    ...toSafeUser(row),
    password: String(row.password || ''),
  };
}

export function getUserByEmail(email: string): null | RbacUser {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const row = db
    .prepare(
      'SELECT id, username, email, password, real_name, role, group_id, enabled, home_path FROM rbac_users WHERE email = ? LIMIT 1',
    )
    .get(normalized);

  if (!row) {
    return null;
  }

  return {
    ...toSafeUser(row),
    password: String(row.password || ''),
  };
}

export function findAuthUser(account: string, password: string) {
  const normalized = String(account || '').trim();
  const user = normalized.includes('@')
    ? getUserByEmail(normalized)
    : getUserByUsername(normalized);
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
  const email = normalizeEmail(payload.email);
  const realName = String(payload.realName || '').trim();
  const groupId = Number(payload.groupId || 0);
  const role = String(payload.roles?.[0] || 'user');

  if (!username) {
    throw new Error('用户名不能为空');
  }
  if (!isValidUsername(username)) {
    throw new Error('用户名需为4-32位，仅支持字母、数字、_、-、.');
  }
  if (!email) {
    throw new Error('邮箱不能为空');
  }
  if (!isValidEmail(email)) {
    throw new Error('邮箱格式不正确');
  }
  if (!realName) {
    throw new Error('姓名不能为空');
  }
  if (!groupId) {
    throw new Error('用户组不能为空');
  }
  if (!['admin', 'super', 'user'].includes(role)) {
    throw new Error('角色不合法');
  }

  const groupExists = db
    .prepare('SELECT id FROM rbac_groups WHERE id = ?')
    .get(groupId);
  if (!groupExists) {
    throw new Error('用户组不存在');
  }

  if (payload.id !== undefined && payload.id !== null) {
    const existing = db
      .prepare(
        'SELECT id, username, email, role, password FROM rbac_users WHERE id = ? LIMIT 1',
      )
      .get(payload.id);
    if (!existing) {
      throw new Error('用户不存在');
    }
    if (existing.role === 'super' && role !== 'super') {
      throw new Error('超级管理员账号角色不可降级');
    }

    const usernameExists = db
      .prepare(
        'SELECT id FROM rbac_users WHERE username = ? AND id <> ? LIMIT 1',
      )
      .get(username, payload.id);
    if (usernameExists) {
      throw new Error('用户名已存在');
    }

    const emailExists = db
      .prepare('SELECT id FROM rbac_users WHERE email = ? AND id <> ? LIMIT 1')
      .get(email, payload.id);
    if (emailExists) {
      throw new Error('邮箱已存在');
    }

    db.prepare(
      `UPDATE rbac_users
       SET username = ?, email = ?, real_name = ?, role = ?, group_id = ?, enabled = ?,
           home_path = ?, password = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      username,
      email,
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
    .prepare(
      'SELECT id FROM rbac_users WHERE username = ? OR email = ? LIMIT 1',
    )
    .get(username, email);
  if (existed) {
    throw new Error('用户名或邮箱已存在');
  }

  db.prepare(
    `INSERT INTO rbac_users
     (username, email, password, real_name, role, group_id, enabled, home_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    username,
    email,
    String(payload.password),
    realName,
    role,
    groupId,
    payload.enabled === false ? 0 : 1,
    payload.homePath || '/analytics',
    nowText(),
    nowText(),
  );

  const createdId = Number(
    db.prepare('SELECT last_insert_rowid() as id').get()?.id || 0,
  );
  return listUsers().find((item) => item.id === createdId);
}

export function deleteUser(id: number) {
  const target = db
    .prepare('SELECT id, role FROM rbac_users WHERE id = ?')
    .get(id);
  if (!target) {
    throw new Error('用户不存在');
  }
  if (String(target.role) === 'super') {
    throw new Error('超级管理员账号不可删除');
  }
  db.prepare('DELETE FROM rbac_users WHERE id = ?').run(id);
}

export function setUserEnabled(id: number, enabled: boolean) {
  const target = db
    .prepare('SELECT id, role FROM rbac_users WHERE id = ? LIMIT 1')
    .get(id);
  if (!target) {
    throw new Error('用户不存在');
  }

  if (String(target.role) === 'super' && !enabled) {
    throw new Error('超级管理员账号不可禁用');
  }

  db.prepare(
    'UPDATE rbac_users SET enabled = ?, updated_at = ? WHERE id = ?',
  ).run(enabled ? 1 : 0, nowText(), id);

  return listUsers().find((item) => item.id === id);
}

function getDefaultUserGroupId() {
  const viewGroup = db
    .prepare('SELECT id FROM rbac_groups WHERE name = ? LIMIT 1')
    .get('查看权限组');
  if (viewGroup?.id) {
    return Number(viewGroup.id);
  }

  const firstGroup = db
    .prepare('SELECT id FROM rbac_groups ORDER BY id ASC LIMIT 1')
    .get();
  if (firstGroup?.id) {
    return Number(firstGroup.id);
  }

  throw new Error('默认用户组不存在，请联系管理员');
}

function randomDigits(length = 6) {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += `${Math.floor(Math.random() * 10)}`;
  }
  return code;
}

export function getNotificationSettings(): NotificationSettings {
  const row = db
    .prepare(
      `SELECT smtp_host, smtp_port, smtp_username, smtp_password, use_ssl,
              from_email, from_name, subject_template, body_template,
              approval_subject_template, approval_body_template
       FROM notification_settings WHERE id = 1 LIMIT 1`,
    )
    .get();

  const settings: NotificationSettings = {
    approvalBodyTemplate: String(
      row?.approval_body_template || DEFAULT_APPROVAL_BODY,
    ),
    approvalSubjectTemplate: String(
      row?.approval_subject_template || DEFAULT_APPROVAL_SUBJECT,
    ),
    bodyTemplate: String(row?.body_template || DEFAULT_NOTIFY_BODY),
    configured: false,
    fromEmail: normalizeEmail(row?.from_email),
    fromName: String(row?.from_name || ''),
    smtpHost: String(row?.smtp_host || '').trim(),
    smtpPassword: String(row?.smtp_password || ''),
    smtpPort: Number(row?.smtp_port || 465),
    smtpUsername: String(row?.smtp_username || '').trim(),
    subjectTemplate: String(row?.subject_template || DEFAULT_NOTIFY_SUBJECT),
    useSSL: Number(row?.use_ssl ?? 1) === 1,
  };

  settings.configured = Boolean(
    settings.smtpHost &&
    settings.smtpPort &&
    settings.smtpUsername &&
    settings.smtpPassword &&
    settings.fromEmail &&
    settings.fromName,
  );

  return settings;
}

export function saveNotificationSettings(
  payload: Partial<NotificationSettings>,
) {
  const smtpHost = String(payload.smtpHost || '').trim();
  const smtpPort = Number(payload.smtpPort || 0);
  const smtpUsername = String(payload.smtpUsername || '').trim();
  const smtpPassword = String(payload.smtpPassword || '').trim();
  const fromEmail = normalizeEmail(payload.fromEmail);
  const fromName = String(payload.fromName || '').trim();
  const subjectTemplate = String(payload.subjectTemplate || '').trim();
  const bodyTemplate = String(payload.bodyTemplate || '').trim();
  const approvalSubjectTemplate = String(
    payload.approvalSubjectTemplate || '',
  ).trim();
  const approvalBodyTemplate = String(payload.approvalBodyTemplate || '').trim();
  const useSSL = payload.useSSL !== false;

  if (!smtpHost) {
    throw new Error('SMTP Host 不能为空');
  }
  if (!smtpPort || smtpPort < 1 || smtpPort > 65_535) {
    throw new Error('SMTP Port 不合法');
  }
  if (!smtpUsername) {
    throw new Error('SMTP Username 不能为空');
  }
  if (!smtpPassword) {
    throw new Error('SMTP Password 不能为空');
  }
  if (!fromEmail || !isValidEmail(fromEmail)) {
    throw new Error('From Email 格式不正确');
  }
  if (!fromName) {
    throw new Error('From Name 不能为空');
  }
  if (!subjectTemplate) {
    throw new Error('Subject 模板不能为空');
  }
  if (!bodyTemplate) {
    throw new Error('Body 模板不能为空');
  }
  if (!approvalSubjectTemplate) {
    throw new Error('审批 Subject 模板不能为空');
  }
  if (!approvalBodyTemplate) {
    throw new Error('审批 Body 模板不能为空');
  }

  db.prepare(
    `UPDATE notification_settings
     SET smtp_host = ?, smtp_port = ?, smtp_username = ?, smtp_password = ?,
         use_ssl = ?, from_email = ?, from_name = ?,
         subject_template = ?, body_template = ?,
         approval_subject_template = ?, approval_body_template = ?,
         updated_at = ?
     WHERE id = 1`,
  ).run(
    smtpHost,
    smtpPort,
    smtpUsername,
    smtpPassword,
    useSSL ? 1 : 0,
    fromEmail,
    fromName,
    subjectTemplate,
    bodyTemplate,
    approvalSubjectTemplate,
    approvalBodyTemplate,
    nowText(),
  );

  return getNotificationSettings();
}

function sendEmailBySettings(options: {
  appName: string;
  bodyTemplate?: string;
  code: string;
  email: string;
  minutes: number;
  subjectTemplate?: string;
}) {
  const settings = getNotificationSettings();
  if (!settings.configured) {
    throw new Error('邮箱配置未完成，请联系管理员配置');
  }

  const variables = {
    app_name: options.appName,
    code: options.code,
    minutes: options.minutes,
  };

  const subject = fillTemplate(
    options.subjectTemplate || settings.subjectTemplate,
    variables,
  );
  const body = fillTemplate(
    options.bodyTemplate || settings.bodyTemplate,
    variables,
  );

  const require = createRequire(import.meta.url);
  let nodemailer: any;
  try {
    nodemailer = require('nodemailer');
  } catch {
    throw new Error('邮件依赖缺失，请安装 nodemailer 后重试');
  }

  const transporter = nodemailer.createTransport({
    auth: {
      pass: settings.smtpPassword,
      user: settings.smtpUsername,
    },
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.useSSL,
  });

  return transporter.sendMail({
    from: `${settings.fromName} <${settings.fromEmail}>`,
    subject,
    text: body,
    to: options.email,
  });
}

export async function sendRegisterEmailCode(payload: {
  appName: string;
  email: string;
  minutes?: number;
}) {
  const email = normalizeEmail(payload.email);
  if (!email || !isValidEmail(email)) {
    throw new Error('邮箱格式不正确');
  }

  const settings = getNotificationSettings();
  if (!settings.configured) {
    throw new Error('邮箱配置未完成，请联系管理员配置');
  }

  const exists = getUserByEmail(email);
  if (exists) {
    throw new Error('该邮箱已注册');
  }

  const minutes = Math.max(1, Math.min(30, Number(payload.minutes || 10)));
  const code = randomDigits(6);
  const now = nowText();
  const expiresAt = formatDateByMinutes(minutes);

  db.prepare(
    'UPDATE email_verification_codes SET used = 1 WHERE scene = ? AND email = ? AND used = 0',
  ).run('register', email);

  db.prepare(
    'INSERT INTO email_verification_codes (scene, email, code, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)',
  ).run('register', email, code, expiresAt, now);

  await sendEmailBySettings({
    appName: payload.appName,
    code,
    email,
    minutes,
  });

  return { email, expiresAt };
}

export async function testNotificationSettings(payload: {
  appName: string;
  testEmail: string;
}) {
  const email = normalizeEmail(payload.testEmail);
  if (!email || !isValidEmail(email)) {
    throw new Error('测试邮箱格式不正确');
  }

  const code = randomDigits(6);
  await sendEmailBySettings({
    appName: payload.appName,
    code,
    email,
    minutes: 10,
    subjectTemplate: '【{{app_name}}】邮件配置测试',
    bodyTemplate:
      '你好，\n\n这是 {{app_name}} 的邮件配置测试邮件。\n验证码样例：{{code}}，有效期 {{minutes}} 分钟。\n\n如果你收到此邮件，说明配置可用。',
  });

  return true;
}

export async function testApprovalNotificationSettings(payload: {
  appName: string;
  testEmail: string;
}) {
  const email = normalizeEmail(payload.testEmail);
  if (!email || !isValidEmail(email)) {
    throw new Error('测试邮箱格式不正确');
  }

  const settings = getNotificationSettings();
  if (!settings.configured) {
    throw new Error('邮箱配置未完成，请先保存基础SMTP配置');
  }

  const requestNo = `APRTEST${Date.now()}`;
  const context = {
    action_text: '已提交',
    applicant_user: '测试用户',
    app_name: payload.appName,
    approve_timeout_hours: 24,
    current_expire_time: '2026-03-01 12:00:00',
    reason: '这是审批文案测试邮件',
    request_no: requestNo,
    room_name: '测试群',
    room_wxid: 'test_room@chatroom',
    submitted_at: nowText(),
    target_expire_time: '2026-03-03 12:00:00',
    type_label: '过期时间修改',
  };

  const subject = fillTemplate(settings.approvalSubjectTemplate, context);
  const body = fillTemplate(settings.approvalBodyTemplate, context);

  const require = createRequire(import.meta.url);
  let nodemailer: any;
  try {
    nodemailer = require('nodemailer');
  } catch {
    throw new Error('邮件依赖缺失，请安装 nodemailer 后重试');
  }

  const transporter = nodemailer.createTransport({
    auth: {
      pass: settings.smtpPassword,
      user: settings.smtpUsername,
    },
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.useSSL,
  });

  await transporter.sendMail({
    from: `${settings.fromName} <${settings.fromEmail}>`,
    subject,
    text: body,
    to: email,
  });

  return true;
}

function consumeRegisterCode(email: string, code: string) {
  const row = db
    .prepare(
      `SELECT id, code, expires_at, used
       FROM email_verification_codes
       WHERE scene = 'register' AND email = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email);

  if (!row) {
    throw new Error('验证码不存在，请先获取验证码');
  }
  if (Number(row.used) === 1) {
    throw new Error('验证码已使用，请重新获取');
  }
  if (String(row.code) !== code) {
    throw new Error('验证码错误');
  }

  const expiresTime = Date.parse(String(row.expires_at).replace(' ', 'T'));
  if (Number.isNaN(expiresTime) || expiresTime < Date.now()) {
    throw new Error('验证码已过期，请重新获取');
  }

  db.prepare('UPDATE email_verification_codes SET used = 1 WHERE id = ?').run(
    row.id,
  );
}

function createUsernameFromEmail(email: string) {
  const prefixRaw = email.split('@')[0] || 'user';
  const prefix = prefixRaw.replaceAll(/[^\w.-]/g, '').slice(0, 24) || 'user';
  const base = prefix.length >= 4 ? prefix : `${prefix}user`;

  for (let index = 0; index < 1000; index += 1) {
    const suffix =
      index === 0 ? '' : `${Math.floor(Math.random() * 9000) + 1000}`;
    const username = `${base}${suffix}`.slice(0, 32);
    if (!getUserByUsername(username)) {
      return username;
    }
  }

  throw new Error('自动生成用户名失败，请重试');
}

export function registerByEmail(payload: {
  code: string;
  confirmPassword: string;
  email: string;
  password: string;
}) {
  const email = normalizeEmail(payload.email);
  const code = String(payload.code || '').trim();
  const password = String(payload.password || '');
  const confirmPassword = String(payload.confirmPassword || '');

  if (!email || !isValidEmail(email)) {
    throw new Error('邮箱格式不正确');
  }
  if (!code || code.length !== 6) {
    throw new Error('验证码格式不正确');
  }
  if (!password || password.length < 6) {
    throw new Error('密码至少6位');
  }
  if (password !== confirmPassword) {
    throw new Error('两次密码输入不一致');
  }
  if (getUserByEmail(email)) {
    throw new Error('该邮箱已注册');
  }

  consumeRegisterCode(email, code);

  const username = createUsernameFromEmail(email);
  const groupId = getDefaultUserGroupId();

  const created = saveUser({
    email,
    enabled: true,
    groupId,
    password,
    realName: username,
    roles: ['user'],
    username,
  });

  return created;
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
  const parsed = group ? parsePermissions(String(group.permissions || '[]')) : [];
  const merged = new Set(parsed);

  for (const code of parsed) {
    for (const mappedCode of LEGACY_VIEW_CODE_MAP[code] || []) {
      merged.add(mappedCode);
    }
    for (const mappedCode of LEGACY_EDIT_CODE_MAP[code] || []) {
      merged.add(mappedCode);
    }
    for (const mappedCode of IMPLIED_VIEW_CODE_MAP[code] || []) {
      merged.add(mappedCode);
    }
  }

  return [...merged];
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

  const maixuUserChildren: any[] = [];
  if (has('MX_USER_GROUP_VIEW')) {
    maixuUserChildren.push({
      component: '/maixu-user/group-list/index',
      meta: { affixTab: false, title: '群列表' },
      name: 'MaixuUserGroupList',
      path: '/maixu-user/group-list',
    });
  }
  if (has('MX_USER_ORDER_VIEW')) {
    maixuUserChildren.push({
      component: '/maixu-user/order-record/index',
      meta: { affixTab: false, title: '麦序记录' },
      name: 'MaixuUserOrderRecord',
      path: '/maixu-user/order-record',
    });
  }
  if (has('MX_USER_KEYWORD_VIEW')) {
    maixuUserChildren.push({
      component: '/maixu-user/keyword-stat/index',
      meta: { affixTab: false, title: '关键字统计' },
      name: 'MaixuUserKeywordStat',
      path: '/maixu-user/keyword-stat',
    });
  }
  if (has('MX_USER_TOP_VIEW')) {
    maixuUserChildren.push({
      component: '/maixu-user/top-card/index',
      meta: { affixTab: false, title: '置顶卡设置' },
      name: 'MaixuUserTopCard',
      path: '/maixu-user/top-card',
    });
  }

  const applyBusinessChildren: any[] = [];
  if (has('MX_APPLY_SUBMIT_VIEW')) {
    applyBusinessChildren.push({
      component: '/apply-business/submit/index',
      meta: { affixTab: false, title: '提交申请' },
      name: 'ApplyBusinessSubmit',
      path: '/apply-business/submit',
    });
  }
  if (has('MX_APPLY_MINE_VIEW')) {
    applyBusinessChildren.push({
      component: '/apply-business/mine/index',
      meta: { affixTab: false, title: '我的申请' },
      name: 'ApplyBusinessMine',
      path: '/apply-business/mine',
    });
  }
  if (isSuper && has('MX_APPLY_REVIEW_VIEW')) {
    applyBusinessChildren.push({
      component: '/apply-business/review/index',
      meta: { affixTab: false, title: '我的审批' },
      name: 'ApplyBusinessReview',
      path: '/apply-business/review',
    });
  }

  const systemChildren: any[] = [];
  if (isSuper && has('MX_USER_VIEW')) {
    systemChildren.push({
      component: '/system-config/user-manage/index',
      meta: { affixTab: false, title: '用户管理' },
      name: 'SystemUserManage',
      path: '/system-config/user-manage',
    });
  }
  if (isSuper && has('MX_RBAC_VIEW')) {
    systemChildren.push({
      component: '/maixu/rbac/index',
      meta: { affixTab: false, title: '权限分组管理' },
      name: 'SystemRbac',
      path: '/system-config/rbac',
    });
  }
  if (isSuper && has('MX_NOTIFY_VIEW')) {
    systemChildren.push({
      component: '/system-config/notify-settings/index',
      meta: { affixTab: false, title: '通知设置' },
      name: 'SystemNotifySettings',
      path: '/system-config/notify-settings',
    });
  }
  if (has('MX_OPLOG_VIEW')) {
    systemChildren.push({
      component: '/system-config/operation-log/index',
      meta: { affixTab: false, title: '操作日志' },
      name: 'SystemOperationLog',
      path: '/system-config/operation-log',
    });
  }
  if (has('MX_SYSLOG_VIEW')) {
    systemChildren.push({
      component: '/system-config/system-log/index',
      meta: { affixTab: false, title: '系统日志' },
      name: 'SystemSystemLog',
      path: '/system-config/system-log',
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

  if (maixuUserChildren.length > 0) {
    menus.push({
      meta: {
        icon: 'solar:users-group-two-rounded-bold-duotone',
        order: 21,
        title: '麦序机器人-用户',
      },
      name: 'MaixuUser',
      path: '/maixu-user',
      redirect: maixuUserChildren[0]?.path || '/maixu-user/group-list',
      children: maixuUserChildren,
    });
  }

  if (applyBusinessChildren.length > 0) {
    menus.push({
      meta: {
        icon: 'solar:document-add-bold-duotone',
        order: 22,
        title: '申请业务',
      },
      name: 'ApplyBusiness',
      path: '/apply-business',
      redirect: applyBusinessChildren[0]?.path || '/apply-business/submit',
      children: applyBusinessChildren,
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

  appendSystemLog({
    detailJson: payload.detailJson,
    level: 'info',
    message: `${payload.page} / ${payload.action}`,
    source: 'operation-log',
    username: payload.username,
  });
}

export function listOperationLogs(query: {
  action?: string;
  end?: string;
  keyword?: string;
  page?: number;
  pageName?: string;
  pageSize?: number;
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
    where.push(
      '(username LIKE ? OR page LIKE ? OR action LIKE ? OR detail_json LIKE ?)',
    );
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
    username: String(row.username || ''),
  }));

  return { list, page, pageSize, total };
}

export function saveOperationLog(
  id: null | number,
  payload: {
    action: string;
    detailJson: string;
    page: string;
    role: string;
    username: string;
  },
) {
  if (!payload.username || !payload.page || !payload.action) {
    throw new Error('username/page/action 不能为空');
  }

  if (id) {
    const existing = db
      .prepare('SELECT id FROM operation_logs WHERE id = ?')
      .get(id);
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
  const existing = db
    .prepare('SELECT id FROM operation_logs WHERE id = ?')
    .get(id);
  if (!existing) {
    throw new Error('日志不存在');
  }
  db.prepare('DELETE FROM operation_logs WHERE id = ?').run(id);
}

function normalizeSystemLogLevel(level: unknown): SystemLogLevel {
  const value = String(level || '')
    .trim()
    .toLowerCase();
  if (value === 'warn') {
    return 'warn';
  }
  if (value === 'error') {
    return 'error';
  }
  return 'info';
}

export function appendSystemLog(payload: {
  detailJson?: string;
  level?: SystemLogLevel;
  message: string;
  source: string;
  username?: string;
}) {
  const level = normalizeSystemLogLevel(payload.level);
  const source = String(payload.source || '').trim() || 'app';
  const message = String(payload.message || '').trim() || '-';
  const detailJson = String(payload.detailJson || '{}').trim() || '{}';
  const username = String(payload.username || '').trim();

  db.prepare(
    'INSERT INTO system_logs (level, source, message, detail_json, username, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(level, source, message, detailJson, username, nowText());
}

export function listSystemLogs(query: {
  end?: string;
  keyword?: string;
  level?: '' | 'error' | 'info' | 'warn';
  page?: number;
  pageSize?: number;
  source?: string;
  start?: string;
  username?: string;
}) {
  const where: string[] = [];
  const params: any[] = [];

  const level = normalizeSystemLogLevel(query.level || '');
  if (query.level && ['info', 'warn', 'error'].includes(String(query.level))) {
    where.push('level = ?');
    params.push(level);
  }

  if (query.source) {
    where.push('source LIKE ?');
    params.push(`%${query.source.trim()}%`);
  }

  if (query.username) {
    where.push('username LIKE ?');
    params.push(`%${query.username.trim()}%`);
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
    where.push('(message LIKE ? OR detail_json LIKE ? OR source LIKE ?)');
    const keyword = `%${query.keyword.trim()}%`;
    params.push(keyword, keyword, keyword);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const total = Number(
    db
      .prepare(`SELECT COUNT(1) as count FROM system_logs ${whereClause}`)
      .get(...params)?.count || 0,
  );

  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.max(1, Math.min(200, Number(query.pageSize || 20)));
  const offset = (page - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT id, level, source, message, detail_json, username, created_at
       FROM system_logs
       ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset);

  const list: SystemLogItem[] = rows.map((row: any) => ({
    createdAt: String(row.created_at || ''),
    detailJson: String(row.detail_json || '{}'),
    id: Number(row.id),
    level: normalizeSystemLogLevel(row.level),
    message: String(row.message || ''),
    source: String(row.source || ''),
    username: String(row.username || ''),
  }));

  return { list, page, pageSize, total };
}
