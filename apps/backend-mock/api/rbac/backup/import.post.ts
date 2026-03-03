import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { importRbacSql } from '~/utils/rbac-store';
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
    const body = await readBody<{ sql?: string }>(event);
    const sql = String(body?.sql || '');
    const result = importRbacSql(sql);
    return useResponseSuccess(result);
  } catch (error) {
    return useResponseError(error instanceof Error ? error.message : '导入失败');
  }
});
