import { eventHandler } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { getUserMenus } from '~/utils/rbac-store';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const menus = getUserMenus(userinfo.username);
  return useResponseSuccess(menus);
});
