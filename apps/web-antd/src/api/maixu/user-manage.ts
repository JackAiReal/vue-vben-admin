import type { PermissionGroup, RbacUser } from './rbac';

import { requestClient } from '#/api/request';

export interface UserManageQueryParams {
  enabled?: '' | 'false' | 'true';
  groupId?: number;
  keyword?: string;
  page?: number;
  pageSize?: number;
  role?: '' | 'admin' | 'super' | 'user';
}

export interface UserManageQueryResult {
  list: RbacUser[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UserManageSavePayload {
  email: string;
  enabled?: boolean;
  groupId: number;
  id?: number;
  password?: string;
  realName: string;
  role: 'admin' | 'super' | 'user';
  username: string;
}

export async function querySystemUsers(params: UserManageQueryParams) {
  return requestClient.post<UserManageQueryResult>('/rbac/users/query', params);
}

export async function saveSystemUser(payload: UserManageSavePayload) {
  return requestClient.post<RbacUser>('/rbac/users/save', {
    ...payload,
    roles: [payload.role],
  });
}

export async function removeSystemUser(id: number) {
  return requestClient.post('/rbac/users/delete', { id });
}

export async function setSystemUserEnabled(id: number, enabled: boolean) {
  return requestClient.post<RbacUser>('/rbac/users/set-enabled', {
    enabled,
    id,
  });
}

export async function listPermissionGroupsForUsers() {
  return requestClient.post<PermissionGroup[]>('/rbac/groups/list');
}
