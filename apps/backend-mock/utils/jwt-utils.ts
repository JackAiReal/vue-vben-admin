import type { EventHandlerRequest, H3Event } from 'h3';

import { getHeader } from 'h3';
import jwt from 'jsonwebtoken';

import { getUserByUsername } from './rbac-store';

// TODO: Replace with your own secret key
const ACCESS_TOKEN_SECRET = 'access_token_secret';
const REFRESH_TOKEN_SECRET = 'refresh_token_secret';

interface JwtUserInfo {
  enabled: boolean;
  groupId: number;
  homePath?: string;
  id: number;
  password: string;
  realName: string;
  roles: string[];
  username: string;
}

export interface UserPayload extends JwtUserInfo {
  exp: number;
  iat: number;
}

export function generateAccessToken(user: JwtUserInfo) {
  return jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
}

export function generateRefreshToken(user: JwtUserInfo) {
  return jwt.sign(user, REFRESH_TOKEN_SECRET, {
    expiresIn: '30d',
  });
}

export function verifyAccessToken(
  event: H3Event<EventHandlerRequest>,
): null | Omit<JwtUserInfo, 'password'> {
  const authHeader = getHeader(event, 'Authorization');
  if (!authHeader?.startsWith('Bearer')) {
    return null;
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2) {
    return null;
  }
  const token = tokenParts[1] as string;
  try {
    const decoded = jwt.verify(
      token,
      ACCESS_TOKEN_SECRET,
    ) as unknown as UserPayload;

    const username = decoded.username;
    const user = getUserByUsername(username);
    if (!user) {
      return null;
    }
    const { password: _pwd, ...userinfo } = user;
    return userinfo;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(
  token: string,
): null | Omit<JwtUserInfo, 'password'> {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as UserPayload;
    const username = decoded.username;
    const user = getUserByUsername(username) as JwtUserInfo | null;
    if (!user) {
      return null;
    }
    const { password: _pwd, ...userinfo } = user;
    return userinfo;
  } catch {
    return null;
  }
}
