import { requestClient } from '#/api/request';

export interface OperationLogItem {
  action: string;
  createdAt: string;
  detailJson: string;
  id: number;
  page: string;
  role: string;
  username: string;
}

export interface OperationLogQueryParams {
  action?: string;
  end?: string;
  keyword?: string;
  page?: number;
  pageName?: string;
  pageSize?: number;
  start?: string;
  username?: string;
}

export interface OperationLogQueryResult {
  list: OperationLogItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OperationLogSavePayload {
  action: string;
  detailJson: string;
  id?: number;
  page: string;
  role: string;
  username: string;
}

export async function queryOperationLogs(params: OperationLogQueryParams) {
  return requestClient.post<OperationLogQueryResult>('/rbac/operation-logs/list', params);
}

export async function createOperationLog(payload: {
  action: string;
  detailJson: string;
  page: string;
}) {
  return requestClient.post('/rbac/operation-logs/create', payload);
}

export async function saveOperationLog(payload: OperationLogSavePayload) {
  return requestClient.post('/rbac/operation-logs/save', payload);
}

export async function deleteOperationLog(id: number) {
  return requestClient.post('/rbac/operation-logs/delete', { id });
}

export async function appendOperationLog(page: string, action: string, detail: any) {
  try {
    await createOperationLog({
      action,
      detailJson: JSON.stringify(detail || {}, null, 2),
      page,
    });
  } catch {
    // ignore log failures
  }
}
