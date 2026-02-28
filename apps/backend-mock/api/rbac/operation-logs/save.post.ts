import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { saveOperationLog } from '~/utils/rbac-store';
import { forbiddenResponse, unAuthorizedResponse, useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  if (!user.roles?.includes('super')) {
    return forbiddenResponse(event, '仅超级管理员可编辑操作日志');
  }

  try {
    const body = await readBody(event);
    const id = body?.id ? Number(body.id) : null;
    const savedId = saveOperationLog(id, {
      action: String(body?.action || ''),
      detailJson: String(body?.detailJson || '{}'),
      page: String(body?.page || ''),
      role: String(body?.role || 'admin'),
      username: String(body?.username || ''),
    });
    return useResponseSuccess({ id: savedId });
  } catch (error) {
    return useResponseError(error instanceof Error ? error.message : '保存失败');
  }
});
