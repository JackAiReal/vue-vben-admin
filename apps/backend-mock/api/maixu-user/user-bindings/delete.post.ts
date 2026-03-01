import { eventHandler, readBody } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { deleteMaixuUserBinding } from '~/utils/maixu-user-store';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody<{ roomWxid?: string }>(event);
  const roomWxid = String(body?.roomWxid || '').trim();
  if (!roomWxid) {
    throw new Error('roomWxid 不能为空');
  }

  deleteMaixuUserBinding(user.username, roomWxid);
  return useResponseSuccess(true);
});
