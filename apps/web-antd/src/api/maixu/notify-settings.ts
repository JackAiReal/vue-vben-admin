import { requestClient } from '#/api/request';

export interface NotifySettings {
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

export async function getNotifySettings() {
  return requestClient.post<NotifySettings>('/rbac/notify-settings/get');
}

export async function saveNotifySettings(payload: NotifySettings) {
  return requestClient.post<NotifySettings>(
    '/rbac/notify-settings/save',
    payload,
  );
}

export async function testNotifySettings(
  testEmail: string,
  appName = '麦序管理后台',
) {
  return requestClient.post<boolean>('/rbac/notify-settings/test', {
    appName,
    testEmail,
  });
}
