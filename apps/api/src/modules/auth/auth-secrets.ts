import { createHash, randomBytes } from 'node:crypto';

import argon2 from 'argon2';

/** Passwords use a salted, deliberately expensive Argon2id hash. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  passwordHash: string | null,
  password: string,
): Promise<boolean> {
  // OAuth-only users have no local password.
  if (!passwordHash?.startsWith('$argon2id$')) return false;
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Only for high-entropy server-generated tokens, never passwords. */
export function hashToken(token: string): string {
  if (token.length === 0) throw new Error('Token must not be empty');
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Return the raw value to the delivery layer; persist only tokenHash. */
export function generateOneTimeToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}
