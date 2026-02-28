import { eventHandler } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { listUsers } from '~/utils/rbac-store';
import { forbiddenResponse, unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler((event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  if (!user.roles.includes('super')) {
    return forbiddenResponse(event, '仅超级管理员可访问');
  }

  return useResponseSuccess(listUsers());
});
