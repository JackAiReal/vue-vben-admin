import { eventHandler, readBody } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { saveNotificationSettings } from '~/utils/rbac-store';
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
    const data = saveNotificationSettings(body || {});
    return useResponseSuccess(data);
  } catch (error) {
    return useResponseError(
      error instanceof Error ? error.message : '保存失败',
    );
  }
});
