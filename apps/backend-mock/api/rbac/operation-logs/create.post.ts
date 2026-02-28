import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { appendOperationLog } from '~/utils/rbac-store';
import { unAuthorizedResponse, useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = await readBody(event);
    appendOperationLog({
      action: String(body?.action || '未知操作'),
      detailJson: String(body?.detailJson || '{}'),
      page: String(body?.page || '未知页面'),
      role: String(user.roles?.[0] || 'user'),
      username: user.username,
    });
    return useResponseSuccess(true);
  } catch (error) {
    return useResponseError(error instanceof Error ? error.message : '记录失败');
  }
});
