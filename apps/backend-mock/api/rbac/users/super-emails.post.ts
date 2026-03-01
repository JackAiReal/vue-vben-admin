import { eventHandler } from 'h3';

import { verifyAccessToken } from '~/utils/jwt-utils';
import { listUsers } from '~/utils/rbac-store';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler((event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }

  const emails = listUsers()
    .filter((item) => (item.roles || []).includes('super'))
    .map((item) => String(item.email || '').trim())
    .filter((item) => item.includes('@'));

  return useResponseSuccess([...new Set(emails)]);
});
