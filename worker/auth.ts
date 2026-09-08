const SESSION_COOKIE_NAME = '__Host-streamarkr_session';
const SESSION_CONTEXT = 'streamarkr-browser-session-v1';
export const BROWSER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || null;
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim() || null;
  }
  return null;
}

async function digest(value: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(result);
}

async function hmac(value: string, keyMaterial: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyMaterial),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function sessionPayload(expiresAt: number, nonce: string): string {
  return `${SESSION_CONTEXT}.${expiresAt}.${nonce}`;
}

export async function isDeviceTokenValueAuthorized(suppliedToken: string | null, expectedToken: string): Promise<boolean> {
  const supplied = suppliedToken?.trim() || null;
  if (!supplied || !expectedToken) return false;
  const [suppliedDigest, expectedDigest] = await Promise.all([digest(supplied), digest(expectedToken)]);
  return equalBytes(suppliedDigest, expectedDigest);
}

export async function isDeviceTokenAuthorized(request: Request, expectedToken: string): Promise<boolean> {
  return isDeviceTokenValueAuthorized(bearerToken(request), expectedToken);
}

export async function createBrowserSession(expectedToken: string, nowMs = Date.now()): Promise<{ token: string; expiresAt: string }> {
  if (!expectedToken) throw new Error('Browser session signing requires a configured device token');
  const expiresAtSeconds = Math.floor(nowMs / 1000) + BROWSER_SESSION_TTL_SECONDS;
  const nonce = crypto.randomUUID();
  const signature = await hmac(sessionPayload(expiresAtSeconds, nonce), expectedToken);
  return {
    token: `${expiresAtSeconds}.${nonce}.${toBase64Url(signature)}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  };
}

export async function isBrowserSessionAuthorized(request: Request, expectedToken: string, nowMs = Date.now()): Promise<boolean> {
  const token = cookieValue(request, SESSION_COOKIE_NAME);
  if (!token || !expectedToken) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expiresRaw, nonce, signatureRaw] = parts;
  if (!/^\d{10,}$/.test(expiresRaw) || !/^[0-9a-f-]{36}$/i.test(nonce)) return false;
  const expiresAtSeconds = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds <= Math.floor(nowMs / 1000)) return false;
  const suppliedSignature = fromBase64Url(signatureRaw);
  if (!suppliedSignature) return false;
  const expectedSignature = await hmac(sessionPayload(expiresAtSeconds, nonce), expectedToken);
  return equalBytes(suppliedSignature, expectedSignature);
}

export type AuthorizationKind = 'device-token' | 'browser-session';

export async function authorizationKind(request: Request, expectedToken: string): Promise<AuthorizationKind | null> {
  if (await isDeviceTokenAuthorized(request, expectedToken)) return 'device-token';
  if (await isBrowserSessionAuthorized(request, expectedToken)) return 'browser-session';
  return null;
}

export async function isAuthorized(request: Request, expectedToken: string): Promise<boolean> {
  return (await authorizationKind(request, expectedToken)) !== null;
}

export function browserSessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${BROWSER_SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=None`;
}

export function clearBrowserSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`;
}
