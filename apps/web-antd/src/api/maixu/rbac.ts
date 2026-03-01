import { requestClient } from '#/api/request';

export interface PermissionDef {
  category: string;
  code: string;
  label: string;
  menuGroup?: string;
  order?: number;
}

export interface PermissionGroup {
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
  groupName?: string;
  homePath?: string;
  id: number;
  realName: string;
  roles: string[];
  username: string;
}

export interface SaveGroupPayload {
  description?: string;
  id?: number;
  name: string;
  permissions: string[];
}

export interface SaveUserPayload {
  email?: string;
  enabled?: boolean;
  groupId: number;
  homePath?: string;
  id?: number;
  password?: string;
  realName: string;
  role: 'admin' | 'super' | 'user';
  username: string;
}

export async function fetchPermissionDefs() {
  return requestClient.get<PermissionDef[]>('/rbac/permissions/list');
}

export async function fetchPermissionGroups() {
  return requestClient.post<PermissionGroup[]>('/rbac/groups/list');
}

export async function savePermissionGroup(payload: SaveGroupPayload) {
  return requestClient.post<PermissionGroup>('/rbac/groups/save', payload);
}

export async function deletePermissionGroup(id: number) {
  return requestClient.post('/rbac/groups/delete', { id });
}

export async function fetchRbacUsers() {
  return requestClient.post<RbacUser[]>('/rbac/users/list');
}

export async function saveRbacUser(payload: SaveUserPayload) {
  return requestClient.post<RbacUser>('/rbac/users/save', {
    ...payload,
    roles: [payload.role],
  });
}

export async function deleteRbacUser(id: number) {
  return requestClient.post('/rbac/users/delete', { id });
}
