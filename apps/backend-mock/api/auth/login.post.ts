import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '~/utils/cookie-utils';
import { generateAccessToken, generateRefreshToken } from '~/utils/jwt-utils';
import { findAuthUser } from '~/utils/rbac-store';
import {
  forbiddenResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default defineEventHandler(async (event) => {
  const { account, humanVerified, password, username } = await readBody(event);
  const loginAccount = String(account || username || '').trim();
  if (!password || !loginAccount) {
    setResponseStatus(event, 400);
    return useResponseError(
      'BadRequestException',
      'Account and password are required',
    );
  }

  if (humanVerified !== true) {
    return useResponseError('请先完成人机校验');
  }

  const findUser = findAuthUser(loginAccount, password);

  if (!findUser) {
    clearRefreshTokenCookie(event);
    return forbiddenResponse(event, 'Username or password is incorrect.');
  }

  const accessToken = generateAccessToken(findUser);
  const refreshToken = generateRefreshToken(findUser);

  setRefreshTokenCookie(event, refreshToken);

  return useResponseSuccess({
    ...findUser,
    accessToken,
  });
});
