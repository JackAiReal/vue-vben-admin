import { requestClient } from '#/api/request';

export interface BackupExportResult {
  filename: string;
  sql: string;
}

export interface BackupImportResult {
  importedAt: string;
}

export async function exportSystemBackupSql() {
  return requestClient.post<BackupExportResult>('/rbac/backup/export');
}

export async function importSystemBackupSql(sql: string) {
  return requestClient.post<BackupImportResult>('/rbac/backup/import', {
    sql,
  });
}
