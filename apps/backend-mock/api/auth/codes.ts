import { eventHandler } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getUserAccessCodes } from '~/utils/rbac-store';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler((event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const codes = getUserAccessCodes(userinfo.username);

  return useResponseSuccess(codes);
});
