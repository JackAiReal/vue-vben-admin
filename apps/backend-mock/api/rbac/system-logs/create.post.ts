import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { appendSystemLog } from '~/utils/rbac-store';
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

  const role = String(user.roles?.[0] || 'user');
  if (!['super', 'admin'].includes(role)) {
    return forbiddenResponse(event, '无系统日志写入权限');
  }

  try {
    const body = await readBody(event);
    const message = String(body?.message || '').trim();
    if (!message) {
      return useResponseError('message 不能为空');
    }

    appendSystemLog({
      detailJson: String(body?.detailJson || '{}'),
      level: body?.level,
      message,
      source: String(body?.source || 'manual').trim() || 'manual',
      username: user.username,
    });

    return useResponseSuccess(true);
  } catch (error) {
    return useResponseError(error instanceof Error ? error.message : '记录失败');
  }
});
