import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { createMaixuBindCode } from '~/utils/maixu-user-store';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }
  if (!user.roles.includes('admin') && !user.roles.includes('super')) {
    return forbiddenResponse(event, '仅管理员可生成绑定验证码');
  }

  const body = await readBody<{
    minutes?: number;
    roomName?: string;
    roomWxid?: string;
    sourceWxid?: string;
  }>(event);

  const bindInfo = createMaixuBindCode({
    minutes: body?.minutes,
    roomName: body?.roomName,
    roomWxid: String(body?.roomWxid || ''),
    sourceWxid: body?.sourceWxid,
  });

  return useResponseSuccess(bindInfo);
});
