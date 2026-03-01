import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { consumeMaixuBindCode } from '~/utils/maixu-user-store';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody<{ code?: string }>(event);
  const code = String(body?.code || '').trim();
  if (!code) {
    throw new Error('验证码不能为空');
  }

  const bindInfo = consumeMaixuBindCode(user.username, code);
  return useResponseSuccess(bindInfo);
});
