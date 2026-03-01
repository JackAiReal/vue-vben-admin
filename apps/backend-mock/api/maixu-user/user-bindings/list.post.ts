import { eventHandler } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { listMaixuUserBindings } from '~/utils/maixu-user-store';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler((event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }

  return useResponseSuccess(listMaixuUserBindings(user.username));
});
