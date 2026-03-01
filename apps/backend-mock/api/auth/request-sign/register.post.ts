import { defineEventHandler, readBody, setResponseStatus } from 'h3';

import {
  readAccessTokenFromAuthorization,
  verifyAccessToken,
} from '~/utils/jwt-utils';
import { registerRequestSignSession } from '~/utils/request-sign-store';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

const SUPPORTED_ALGORITHM = 'MX_CUSTOM_V1';
const SUPPORTED_SCOPE = 'maixu';

export default defineEventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }

  const token = readAccessTokenFromAuthorization(event);
  if (!token) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);
  const algorithm = String(body?.algorithm || '').trim();
  const scope = String(body?.scope || '').trim();
  const publicKey = String(body?.publicKey || '').trim();

  if (algorithm !== SUPPORTED_ALGORITHM) {
    setResponseStatus(event, 400);
    return useResponseError('不支持的签名算法');
  }

  if (scope !== SUPPORTED_SCOPE) {
    setResponseStatus(event, 400);
    return useResponseError('不支持的签名作用域');
  }

  try {
    const result = await registerRequestSignSession({
      algorithm,
      publicKey,
      scope,
      token,
      username: user.username,
    });

    return useResponseSuccess(result);
  } catch (error) {
    setResponseStatus(event, 400);
    return useResponseError(
      error instanceof Error ? error.message : '签名会话注册失败',
    );
  }
});
