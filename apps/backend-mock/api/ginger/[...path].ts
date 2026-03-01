import {
  eventHandler,
  getMethod,
  getRequestHeaders,
  getRequestURL,
  readRawBody,
  setHeader,
  setResponseStatus,
} from 'h3';

import {
  readAccessTokenFromAuthorization,
  verifyAccessToken,
} from '~/utils/jwt-utils';
import { verifyRequestSignature } from '~/utils/request-sign-store';
import { appendSystemLog, getUserAccessCodes } from '~/utils/rbac-store';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
} from '~/utils/response';

const DEFAULT_GINGER_BASE = 'http://127.0.0.1:5001';

const ROUTE_PERMISSION_MAP: Array<{
  editCodes: string[];
  prefix: string;
  viewCodes: string[];
}> = [
  {
    editCodes: ['MX_USER_GROUP_EDIT'],
    prefix: '/v1/room_super/',
    viewCodes: ['MX_USER_GROUP_VIEW'],
  },
  {
    editCodes: ['MX_USER_GROUP_EDIT'],
    prefix: '/v1/room_bind/',
    viewCodes: ['MX_USER_GROUP_VIEW'],
  },
  {
    editCodes: ['MX_USER_ORDER_EDIT'],
    prefix: '/v1/room_list/',
    viewCodes: ['MX_USER_ORDER_VIEW'],
  },
  {
    editCodes: ['MX_USER_KEYWORD_EDIT'],
    prefix: '/v1/tag_total/',
    viewCodes: ['MX_USER_KEYWORD_VIEW'],
  },
  {
    editCodes: ['MX_USER_TOP_EDIT'],
    prefix: '/v1/room_top/',
    viewCodes: ['MX_USER_TOP_VIEW'],
  },
  {
    editCodes: ['MX_MEMBER_EDIT'],
    prefix: '/v1/wx_room_user/',
    viewCodes: ['MX_MEMBER_VIEW'],
  },
  {
    editCodes: [
      'MX_APPLY_SUBMIT_EDIT',
      'MX_APPLY_MINE_EDIT',
      'MX_APPLY_REVIEW_EDIT',
    ],
    prefix: '/v1/approval/',
    viewCodes: [
      'MX_APPLY_SUBMIT_VIEW',
      'MX_APPLY_MINE_VIEW',
      'MX_APPLY_REVIEW_VIEW',
    ],
  },
];

const READ_ROUTE_HINTS = new Set([
  'detail',
  'export',
  'find',
  'get',
  'info',
  'list',
  'query',
]);

const SIGN_ALGORITHM = 'MX_CUSTOM_V1';
const SIGN_SCOPE = 'maixu';

function hasAnyCode(accessCodes: string[], requiredCodes: string[]) {
  return requiredCodes.some((code) => accessCodes.includes(code));
}

function getRequiredCodes(pathname: string, method: string) {
  const rule = ROUTE_PERMISSION_MAP.find((item) => pathname.startsWith(item.prefix));
  if (!rule) {
    return null;
  }

  const upperMethod = method.toUpperCase();
  if (upperMethod === 'GET' || upperMethod === 'HEAD' || upperMethod === 'OPTIONS') {
    return rule.viewCodes;
  }

  const action = pathname.split('/').pop()?.toLowerCase() || '';
  const isReadAction = [...READ_ROUTE_HINTS].some(
    (hint) => action.startsWith(`${hint}_`) || action.endsWith(`_${hint}`) || action === hint,
  );

  return isReadAction ? rule.viewCodes : rule.editCodes;
}

function pickProxyHeaders(headers: Record<string, string | undefined>) {
  const nextHeaders: Record<string, string> = {};

  if (headers.accept) {
    nextHeaders.accept = headers.accept;
  }
  if (headers['content-type']) {
    nextHeaders['content-type'] = headers['content-type'];
  }

  const serviceToken = process.env.GINGER_SERVICE_TOKEN;
  if (serviceToken) {
    nextHeaders.token = serviceToken;
  }

  return nextHeaders;
}

function readProxyBaseUrl() {
  const configured = process.env.GINGER_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return DEFAULT_GINGER_BASE;
}

function recordRejectedProxyRequest(payload: {
  algorithm: string;
  bodySize: number;
  method: string;
  nonce: string;
  pathWithQuery: string;
  reason: string;
  remoteIp: string;
  scope: string;
  timestamp: string;
  username: string;
}) {
  appendSystemLog({
    detailJson: JSON.stringify(payload, null, 2),
    level: 'warn',
    message: '签名校验失败，代理请求已拦截',
    source: 'ginger/proxy-signature',
    username: payload.username,
  });
}

export default eventHandler(async (event) => {
  const user = verifyAccessToken(event);
  if (!user) {
    return unAuthorizedResponse(event);
  }

  const pathValue = event.context.params?.path;
  const resolvedPath = Array.isArray(pathValue)
    ? `/${pathValue.join('/')}`
    : `/${String(pathValue || '')}`;

  if (!resolvedPath.startsWith('/v1/')) {
    return forbiddenResponse(event, '只允许访问 /v1/* 路由');
  }

  const method = getMethod(event).toUpperCase();
  const requiredCodes = getRequiredCodes(resolvedPath, method);

  if (!requiredCodes) {
    return forbiddenResponse(event, '该接口不在代理白名单内');
  }

  if (!user.roles?.includes('super')) {
    const accessCodes = getUserAccessCodes(user.username);
    if (!hasAnyCode(accessCodes, requiredCodes)) {
      return forbiddenResponse(event, '权限不足，代理请求已拒绝');
    }
  }

  const accessToken = readAccessTokenFromAuthorization(event);
  if (!accessToken) {
    return unAuthorizedResponse(event);
  }

  const requestUrl = getRequestURL(event);
  const pathWithQuery = `${resolvedPath}${requestUrl.search}`;
  const proxyUrl = `${readProxyBaseUrl()}${pathWithQuery}`;
  const incomingHeaders = getRequestHeaders(event);

  const signature = String(incomingHeaders['x-mx-signature'] || '').trim();
  const nonce = String(incomingHeaders['x-mx-nonce'] || '').trim();
  const timestamp = String(incomingHeaders['x-mx-timestamp'] || '').trim();
  const algorithm = String(incomingHeaders['x-mx-sign-alg'] || '').trim();
  const scope = String(incomingHeaders['x-mx-sign-scope'] || '').trim();

  const canHaveBody = !['GET', 'HEAD'].includes(method);
  const bodyText = canHaveBody ? (await readRawBody(event, 'utf8')) || '' : '';

  if (!signature || !nonce || !timestamp || !algorithm || !scope) {
    recordRejectedProxyRequest({
      algorithm,
      bodySize: bodyText.length,
      method,
      nonce,
      pathWithQuery,
      reason: 'missing-sign-headers',
      remoteIp: String(incomingHeaders['x-forwarded-for'] || event.node.req.socket.remoteAddress || ''),
      scope,
      timestamp,
      username: user.username,
    });
    return forbiddenResponse(event, '非法请求');
  }

  if (algorithm !== SIGN_ALGORITHM || scope !== SIGN_SCOPE) {
    recordRejectedProxyRequest({
      algorithm,
      bodySize: bodyText.length,
      method,
      nonce,
      pathWithQuery,
      reason: 'invalid-sign-meta',
      remoteIp: String(incomingHeaders['x-forwarded-for'] || event.node.req.socket.remoteAddress || ''),
      scope,
      timestamp,
      username: user.username,
    });
    return forbiddenResponse(event, '非法请求');
  }

  const signResult = await verifyRequestSignature({
    algorithm,
    bodyText,
    method,
    nonce,
    pathWithQuery,
    scope,
    signature,
    timestamp,
    token: accessToken,
    username: user.username,
  });

  if (!signResult.ok) {
    recordRejectedProxyRequest({
      algorithm,
      bodySize: bodyText.length,
      method,
      nonce,
      pathWithQuery,
      reason: signResult.reason,
      remoteIp: String(incomingHeaders['x-forwarded-for'] || event.node.req.socket.remoteAddress || ''),
      scope,
      timestamp,
      username: user.username,
    });
    return forbiddenResponse(event, '非法请求');
  }

  const proxyHeaders = pickProxyHeaders(incomingHeaders);
  proxyHeaders['x-openclaw-proxy-user'] = user.username;
  proxyHeaders['x-openclaw-proxy-roles'] = (user.roles || []).join(',');

  try {
    const upstreamResponse = await fetch(proxyUrl, {
      body: canHaveBody ? bodyText : undefined,
      headers: proxyHeaders,
      method,
    });

    setResponseStatus(event, upstreamResponse.status, upstreamResponse.statusText);

    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) {
      setHeader(event, 'content-type', contentType);
    }

    const contentDisposition = upstreamResponse.headers.get('content-disposition');
    if (contentDisposition) {
      setHeader(event, 'content-disposition', contentDisposition);
    }

    const cacheControl = upstreamResponse.headers.get('cache-control');
    if (cacheControl) {
      setHeader(event, 'cache-control', cacheControl);
    }

    const data = await upstreamResponse.arrayBuffer();
    return Buffer.from(data);
  } catch (error) {
    setResponseStatus(event, 502, 'Bad Gateway');
    return useResponseError(
      error instanceof Error ? error.message : '代理业务后端失败',
    );
  }
});
