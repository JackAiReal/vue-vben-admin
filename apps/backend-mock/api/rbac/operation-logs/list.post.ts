import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { listOperationLogs } from '~/utils/rbac-store';
import { forbiddenResponse, unAuthorizedResponse, useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  const role = user.roles?.[0] || 'user';
  if (!['super', 'admin'].includes(role)) {
    return forbiddenResponse(event, '无操作日志查看权限');
  }

  try {
    const body = await readBody(event);
    const result = listOperationLogs({
      action: body?.action,
      end: body?.end,
      keyword: body?.keyword,
      page: body?.page,
      pageName: body?.pageName,
      pageSize: body?.pageSize,
      start: body?.start,
      username: body?.username,
    });
    return useResponseSuccess(result);
  } catch (error) {
    return useResponseError(error instanceof Error ? error.message : '查询失败');
  }
});
