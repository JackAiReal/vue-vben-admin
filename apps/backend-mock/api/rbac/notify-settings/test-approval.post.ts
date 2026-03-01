import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { testApprovalNotificationSettings } from '~/utils/rbac-store';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  if (!user.roles.includes('super')) {
    return forbiddenResponse(event, '仅超级管理员可操作');
  }

  try {
    const body = await readBody(event);
    const testEmail = String(body?.testEmail || '').trim();
    if (!testEmail) {
      return useResponseError('测试邮箱不能为空');
    }

    await testApprovalNotificationSettings({
      appName: String(body?.appName || '麦序管理后台'),
      testEmail,
    });

    return useResponseSuccess(true);
  } catch (error) {
    return useResponseError(
      error instanceof Error ? error.message : '审批测试失败',
    );
  }
});
