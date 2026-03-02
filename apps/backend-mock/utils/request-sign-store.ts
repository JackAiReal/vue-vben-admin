const SIGN_ALGORITHM = 'MX_CUSTOM_V1';
const SIGN_SCOPE = 'maixu';
const SIGN_SALT = process.env.MX_SIGN_SALT?.trim() || 'mx-custom-v1';
const MAX_CLOCK_SKEW_MS =
  Number(process.env.MX_MAX_CLOCK_SKEW_MS || 10 * 60 * 1000) ||
  10 * 60 * 1000;
const NONCE_TTL_MS =
  Number(process.env.MX_NONCE_TTL_MS || 10 * 60 * 1000) || 10 * 60 * 1000;

interface RegisterSignSessionPayload {
  algorithm: string;
  publicKey?: string;
  scope: string;
  token: string;
  username: string;
}

interface VerifyRequestSignaturePayload {
  algorithm: string;
  bodyText: string;
  method: string;
  nonce: string;
  pathWithQuery: string;
  scope: string;
  signature: string;
  timestamp: string;
  token: string;
  username: string;
}

const usedNonces = new Map<string, number>();

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

function cleanupExpiredNonces(now = Date.now()) {
  for (const [key, createdAt] of usedNonces.entries()) {
    if (now - createdAt > NONCE_TTL_MS) {
      usedNonces.delete(key);
    }
  }
}

function decodeSignature(signature: string) {
  if (!/^[A-Za-z0-9+/=]+$/.test(signature)) {
    return null;
  }

  try {
    return Buffer.from(signature, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function buildCanonical(payload: {
  bodyText: string;
  method: string;
  nonce: string;
  pathWithQuery: string;
  scope: string;
  timestamp: string;
  token: string;
}) {
  return [
    payload.method.toUpperCase(),
    payload.pathWithQuery,
    fnv1a32(payload.bodyText),
    payload.timestamp,
    payload.nonce,
    payload.scope,
    fnv1a32(payload.token),
  ].join('|');
}

export async function registerRequestSignSession(
  payload: RegisterSignSessionPayload,
) {
  const algorithm = String(payload.algorithm || '').trim();
  const scope = String(payload.scope || '').trim();

  if (algorithm !== SIGN_ALGORITHM) {
    throw new Error('不支持的签名算法');
  }

  if (scope !== SIGN_SCOPE) {
    throw new Error('不支持的签名作用域');
  }

  return {
    algorithm,
    createdAt: Date.now(),
    scope,
  };
}

export async function verifyRequestSignature(
  payload: VerifyRequestSignaturePayload,
) {
  const now = Date.now();
  cleanupExpiredNonces(now);

  if (payload.algorithm !== SIGN_ALGORITHM) {
    return {
      ok: false,
      reason: 'algorithm-mismatch',
    };
  }

  if (payload.scope !== SIGN_SCOPE) {
    return {
      ok: false,
      reason: 'scope-mismatch',
    };
  }

  const timestamp = Number.parseInt(payload.timestamp, 10);
  if (!Number.isFinite(timestamp)) {
    return {
      ok: false,
      reason: 'invalid-timestamp',
    };
  }

  if (Math.abs(now - timestamp) > MAX_CLOCK_SKEW_MS) {
    return {
      ok: false,
      reason: 'timestamp-expired',
    };
  }

  const nonce = String(payload.nonce || '').trim();
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(nonce)) {
    return {
      ok: false,
      reason: 'invalid-nonce',
    };
  }

  const nonceKey = `${payload.username}:${nonce}`;
  if (usedNonces.has(nonceKey)) {
    return {
      ok: false,
      reason: 'replayed-nonce',
    };
  }

  const decoded = decodeSignature(String(payload.signature || '').trim());
  if (!decoded) {
    return {
      ok: false,
      reason: 'invalid-signature-encoding',
    };
  }

  const separatorIndex = decoded.indexOf('.');
  if (separatorIndex <= 0) {
    return {
      ok: false,
      reason: 'invalid-signature-format',
    };
  }

  const checksum = decoded.slice(0, separatorIndex);
  const raw = decoded.slice(separatorIndex + 1);

  if (!checksum || !raw) {
    return {
      ok: false,
      reason: 'empty-signature-payload',
    };
  }

  const expectedChecksum = fnv1a32(`${raw}|${SIGN_SALT}`);
  if (checksum !== expectedChecksum) {
    return {
      ok: false,
      reason: 'checksum-mismatch',
    };
  }

  const expectedRaw = buildCanonical({
    bodyText: payload.bodyText,
    method: payload.method,
    nonce,
    pathWithQuery: payload.pathWithQuery,
    scope: payload.scope,
    timestamp: payload.timestamp,
    token: payload.token,
  });

  if (raw !== expectedRaw) {
    return {
      ok: false,
      reason: 'signature-content-mismatch',
    };
  }

  usedNonces.set(nonceKey, now);

  return {
    ok: true,
    reason: 'ok',
  };
}
