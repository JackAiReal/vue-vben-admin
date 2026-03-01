import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  appendSystemLog,
  getUserAccessCodes,
  listSystemLogs,
} from '~/utils/rbac-store';
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
    appendSystemLog({
      detailJson: JSON.stringify({ role }, null, 2),
      level: 'warn',
      message: '无系统日志查看权限',
      source: 'rbac/system-logs/list',
      username: user.username,
    });
    return forbiddenResponse(event, '无系统日志查看权限');
  }

  const accessCodes = user.roles?.includes('super')
    ? []
    : getUserAccessCodes(user.username);
  const hasPermission = user.roles?.includes('super')
    ? true
    : accessCodes.includes('MX_SYSLOG_VIEW');

  if (!hasPermission) {
    appendSystemLog({
      detailJson: JSON.stringify({
        accessCodes,
        username: user.username,
      }, null, 2),
      level: 'warn',
      message: '账号缺少系统日志查看权限码 MX_SYSLOG_VIEW',
      source: 'rbac/system-logs/list',
      username: user.username,
    });
    return forbiddenResponse(event, '缺少系统日志查看权限');
  }

  try {
    const body = await readBody(event);
    const result = listSystemLogs({
      end: body?.end,
      keyword: body?.keyword,
      level: body?.level,
      page: body?.page,
      pageSize: body?.pageSize,
      source: body?.source,
      start: body?.start,
      username: body?.username,
    });
    return useResponseSuccess(result);
  } catch (error) {
    appendSystemLog({
      detailJson: JSON.stringify({
        error: error instanceof Error ? error.message : 'unknown',
      }),
      level: 'error',
      message: '系统日志查询失败',
      source: 'rbac/system-logs/list',
      username: user.username,
    });
    return useResponseError(error instanceof Error ? error.message : '查询失败');
  }
});
