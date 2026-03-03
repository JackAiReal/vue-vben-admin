import { eventHandler } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { exportRbacSql } from '~/utils/rbac-store';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler((event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  if (!user.roles.includes('super')) {
    return forbiddenResponse(event, '仅超级管理员可操作');
  }

  try {
    return useResponseSuccess(exportRbacSql());
  } catch (error) {
    return useResponseError(error instanceof Error ? error.message : '导出失败');
  }
});
