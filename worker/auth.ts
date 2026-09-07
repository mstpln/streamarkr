function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || null;
}

async function digest(value: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(result);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

export async function isAuthorized(request: Request, expectedToken: string): Promise<boolean> {
  const supplied = bearerToken(request);
  if (!supplied || !expectedToken) return false;
  const [suppliedDigest, expectedDigest] = await Promise.all([digest(supplied), digest(expectedToken)]);
  return equalBytes(suppliedDigest, expectedDigest);
}
