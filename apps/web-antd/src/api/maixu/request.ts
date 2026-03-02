import { useAccessStore } from '@vben/stores';

const DEFAULT_GINGER_API_BASE = '/api/ginger';
const SIGN_ALGORITHM = 'MX_CUSTOM_V1';
const SIGN_SCOPE = 'maixu';
const SIGN_SALT =
  (import.meta.env.VITE_MX_SIGN_SALT as string | undefined)?.trim() ||
  'mx-custom-v1';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function utf8ToBase64(text: string) {
  return arrayBufferToBase64(new TextEncoder().encode(text).buffer);
}

function fnv1a32(text: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash >>>= 0;
  }

  return hash.toString(16).padStart(8, '0');
}

function createNonce(size = 18) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return arrayBufferToBase64(bytes.buffer)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll(/=+$/g, '');
}

export function getMaixuApiBaseUrl() {
  const envBase = import.meta.env.VITE_GINGER_API_URL as string | undefined;
  if (envBase && envBase.trim()) {
    return envBase.replace(/\/$/, '');
  }

  return DEFAULT_GINGER_API_BASE;
}

export function withMaixuAuthHeaders(
  headers?: HeadersInit,
  { withJsonContentType = true }: { withJsonContentType?: boolean } = {},
) {
  const merged = new Headers(headers ?? {});

  if (withJsonContentType && !merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }

  const accessToken = useAccessStore().accessToken;
  if (accessToken && !merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${accessToken}`);
  }

  return merged;
}

function normalizePathWithQuery(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const parsed = new URL(normalizedPath, 'http://localhost');
  return `${parsed.pathname}${parsed.search}`;
}

function resolveUrl(base: string, path: string) {
  const target = `${base}${normalizePathWithQuery(path)}`;

  if (typeof window !== 'undefined') {
    return new URL(target, window.location.origin);
  }

  return new URL(target, 'http://localhost');
}

function normalizeBodyText(body?: BodyInit | null) {
  if (!body) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  return '';
}

function buildSignature(payload: {
  bodyText: string;
  method: string;
  nonce: string;
  pathWithQuery: string;
  timestamp: string;
  token: string;
}) {
  const bodyDigest = fnv1a32(payload.bodyText);
  const tokenDigest = fnv1a32(payload.token);

  const raw = [
    payload.method,
    payload.pathWithQuery,
    bodyDigest,
    payload.timestamp,
    payload.nonce,
    SIGN_SCOPE,
    tokenDigest,
  ].join('|');

  const checksum = fnv1a32(`${raw}|${SIGN_SALT}`);
  return utf8ToBase64(`${checksum}.${raw}`);
}

export async function fetchMaixu(path: string, init?: RequestInit) {
  const accessToken = useAccessStore().accessToken;
  if (!accessToken) {
    throw new Error('未登录或登录已过期');
  }

  const method = String(init?.method || 'GET').toUpperCase();
  const requestUrl = resolveUrl(getMaixuApiBaseUrl(), path);
  const pathWithQuery = normalizePathWithQuery(path);
  const bodyText = normalizeBodyText(init?.body);
  const timestamp = `${Date.now()}`;
  const nonce = createNonce();

  const signature = buildSignature({
    bodyText,
    method,
    nonce,
    pathWithQuery,
    timestamp,
    token: accessToken,
  });

  const withJsonContentType = !(init?.body instanceof FormData);
  const headers = withMaixuAuthHeaders(init?.headers, {
    withJsonContentType,
  });

  headers.set('X-MX-Nonce', nonce);
  headers.set('X-MX-Sign-Alg', SIGN_ALGORITHM);
  headers.set('X-MX-Sign-Scope', SIGN_SCOPE);
  headers.set('X-MX-Signature', signature);
  headers.set('X-MX-Timestamp', timestamp);

  return fetch(requestUrl.toString(), {
    ...init,
    headers,
    method,
  });
}
