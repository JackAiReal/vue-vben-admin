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
  { category: '权限管理', code: 'MX_RBAC_VIEW', label: '查看权限管理' },
  { category: '权限管理', code: 'MX_RBAC_EDIT', label: '编辑权限管理' },
];

const VIEW_ONLY_CODES = [
  'MX_DASHBOARD_VIEW',
  'MX_ROOM_VIEW',
  'MX_MEMBER_VIEW',
  'MX_ORDER_VIEW',
  'MX_KEYWORD_VIEW',
  'MX_TOP_VIEW',
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

let groups: RbacGroup[] = [
  {
    description: '超级管理员组，拥有所有权限',
    id: 1,
    name: '超级管理员组',
    permissions: ALL_CODES,
    readonly: true,
  },
  {
    description: '默认普通管理员组，仅查看权限',
    id: 2,
    name: '查看权限组',
    permissions: VIEW_ONLY_CODES,
    readonly: true,
  },
  {
    description: '可执行常规业务编辑',
    id: 3,
    name: '可修改权限组',
    permissions: EDITOR_CODES,
  },
];

let users: RbacUser[] = [
  {
    enabled: true,
    groupId: 1,
    homePath: '/analytics',
    id: 0,
    password: '123456',
    realName: 'Vben',
    roles: ['super'],
    username: 'vben',
  },
  {
    enabled: true,
    groupId: 2,
    homePath: '/analytics',
    id: 1,
    password: '123456',
    realName: 'Admin',
    roles: ['admin'],
    username: 'admin',
  },
  {
    enabled: true,
    groupId: 2,
    homePath: '/analytics',
    id: 2,
    password: '123456',
    realName: 'Jack',
    roles: ['user'],
    username: 'jack',
  },
];

function nextGroupId() {
  return groups.length ? Math.max(...groups.map((item) => item.id)) + 1 : 1;
}

function nextUserId() {
  return users.length ? Math.max(...users.map((item) => item.id)) + 1 : 1;
}

function normalizePermissionCodes(codes: string[]) {
  const valid = new Set(RBAC_PERMISSIONS.map((item) => item.code));
  return Array.from(new Set((codes || []).filter((code) => valid.has(code))));
}

function toSafeUser(user: RbacUser) {
  const group = groups.find((item) => item.id === user.groupId);
  return {
    enabled: user.enabled,
    groupId: user.groupId,
    groupName: group?.name || '',
    homePath: user.homePath,
    id: user.id,
    realName: user.realName,
    roles: user.roles,
    username: user.username,
  };
}

export function getPermissionDefinitions() {
  return RBAC_PERMISSIONS;
}

export function listGroups() {
  return [...groups].sort((a, b) => a.id - b.id);
}

export function saveGroup(payload: Partial<RbacGroup>) {
  const name = String(payload.name || '').trim();
  if (!name) {
    throw new Error('分组名称不能为空');
  }

  const permissions = normalizePermissionCodes(payload.permissions || []);

  if (payload.id) {
    const index = groups.findIndex((item) => item.id === payload.id);
    if (index < 0) {
      throw new Error('分组不存在');
    }
    if (groups[index]?.readonly) {
      throw new Error('系统内置分组不允许修改');
    }

    groups[index] = {
      ...groups[index],
      description: String(payload.description || '').trim(),
      name,
      permissions,
    };
    return groups[index];
  }

  const group: RbacGroup = {
    description: String(payload.description || '').trim(),
    id: nextGroupId(),
    name,
    permissions,
  };
  groups.push(group);
  return group;
}

export function deleteGroup(id: number) {
  const target = groups.find((item) => item.id === id);
  if (!target) {
    throw new Error('分组不存在');
  }
  if (target.readonly) {
    throw new Error('系统内置分组不允许删除');
  }
  if (users.some((item) => item.groupId === id)) {
    throw new Error('该分组下仍有用户，无法删除');
  }
  groups = groups.filter((item) => item.id !== id);
}

export function listUsers() {
  return users.map((item) => toSafeUser(item));
}

export function getUserByUsername(username: string) {
  return users.find((item) => item.username === username) || null;
}

export function findAuthUser(username: string, password: string) {
  return (
    users.find(
      (item) =>
        item.username === username &&
        item.password === password &&
        item.enabled,
    ) || null
  );
}

export function saveUser(payload: Partial<RbacUser>) {
  const username = String(payload.username || '').trim();
  if (!username) {
    throw new Error('用户名不能为空');
  }
  const realName = String(payload.realName || '').trim();
  if (!realName) {
    throw new Error('姓名不能为空');
  }

  const role = Array.isArray(payload.roles) && payload.roles.length > 0
    ? String(payload.roles[0])
    : 'user';
  if (!['super', 'admin', 'user'].includes(role)) {
    throw new Error('角色不合法');
  }

  const groupId = Number(payload.groupId || 0);
  const group = groups.find((item) => item.id === groupId);
  if (!group) {
    throw new Error('用户组不存在');
  }

  if (payload.id !== undefined && payload.id !== null) {
    const index = users.findIndex((item) => item.id === payload.id);
    if (index < 0) {
      throw new Error('用户不存在');
    }
    const existing = users[index];
    if (!existing) {
      throw new Error('用户不存在');
    }
    if (existing.roles.includes('super') && role !== 'super') {
      throw new Error('超级管理员账号角色不可降级');
    }

    users[index] = {
      ...existing,
      enabled: payload.enabled ?? existing.enabled,
      groupId,
      homePath: payload.homePath || '/analytics',
      password: payload.password ? String(payload.password) : existing.password,
      realName,
      roles: [role],
      username,
    };
    return toSafeUser(users[index]);
  }

  if (!payload.password) {
    throw new Error('密码不能为空');
  }
  if (users.some((item) => item.username === username)) {
    throw new Error('用户名已存在');
  }

  const user: RbacUser = {
    enabled: payload.enabled ?? true,
    groupId,
    homePath: payload.homePath || '/analytics',
    id: nextUserId(),
    password: String(payload.password),
    realName,
    roles: [role],
    username,
  };
  users.push(user);
  return toSafeUser(user);
}

export function deleteUser(id: number) {
  const target = users.find((item) => item.id === id);
  if (!target) {
    throw new Error('用户不存在');
  }
  if (target.roles.includes('super')) {
    throw new Error('超级管理员账号不可删除');
  }
  users = users.filter((item) => item.id !== id);
}

export function getUserAccessCodes(username: string) {
  const user = getUserByUsername(username);
  if (!user) {
    return [];
  }
  if (user.roles.includes('super')) {
    return ALL_CODES;
  }
  const group = groups.find((item) => item.id === user.groupId);
  return group?.permissions || [];
}

export function getUserMenus(username: string) {
  const user = getUserByUsername(username);
  if (!user) {
    return [];
  }

  const baseMenus = [
    {
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
    },
    {
      meta: {
        icon: 'solar:microphone-2-bold-duotone',
        order: 20,
        title: '麦序机器人',
      },
      name: 'Maixu',
      path: '/maixu',
      redirect: '/maixu/group-list',
      children: [
        {
          component: '/maixu/group-list/index',
          meta: {
            affixTab: false,
            title: '麦序群列表',
          },
          name: 'MaixuGroupList',
          path: '/maixu/group-list',
        },
        {
          component: '/maixu/order-query/index',
          meta: {
            affixTab: false,
            title: '麦序查询',
          },
          name: 'MaixuOrderQuery',
          path: '/maixu/order-query',
        },
        {
          component: '/maixu/keyword-stat/index',
          meta: {
            affixTab: false,
            title: '关键字统计',
          },
          name: 'MaixuKeywordStat',
          path: '/maixu/keyword-stat',
        },
        {
          component: '/maixu/top-card/index',
          meta: {
            affixTab: false,
            title: '置顶卡设置',
          },
          name: 'MaixuTopCard',
          path: '/maixu/top-card',
        },
      ],
    },
  ];

  if (user.roles.includes('super')) {
    baseMenus[1]?.children?.push({
      component: '/maixu/rbac/index',
      meta: {
        affixTab: false,
        title: '权限分组管理',
      },
      name: 'MaixuRbac',
      path: '/maixu/rbac',
    });
  }

  return baseMenus;
}
