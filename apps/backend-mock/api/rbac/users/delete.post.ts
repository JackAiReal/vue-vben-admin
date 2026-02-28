import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { deleteUser } from '~/utils/rbac-store';
import { forbiddenResponse, unAuthorizedResponse, useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  if (!user.roles.includes('super')) {
    return forbiddenResponse(event, '仅超级管理员可访问');
  }

  try {
    const body = await readBody(event);
    const id = Number(body?.id || 0);
    if (!id) {
      return useResponseError('id 不能为空');
    }
    deleteUser(id);
    return useResponseSuccess({ id });
  } catch (error) {
    return useResponseError(error instanceof Error ? error.message : '删除失败');
  }
});
