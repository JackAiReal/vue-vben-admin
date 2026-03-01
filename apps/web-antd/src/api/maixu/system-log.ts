import { requestClient } from '#/api/request';

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

export interface QuerySystemLogParams {
  end?: string;
  keyword?: string;
  level?: '' | SystemLogLevel;
  page?: number;
  pageSize?: number;
  source?: string;
  start?: string;
  username?: string;
}

export interface QuerySystemLogResult {
  list: SystemLogItem[];
  page: number;
  pageSize: number;
  total: number;
}

export async function querySystemLogs(params: QuerySystemLogParams) {
  return requestClient.post<QuerySystemLogResult>('/rbac/system-logs/list', params);
}

export async function createSystemLog(payload: {
  detailJson?: string;
  level?: SystemLogLevel;
  message: string;
  source: string;
}) {
  return requestClient.post('/rbac/system-logs/create', payload);
}
