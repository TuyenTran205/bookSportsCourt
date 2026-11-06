import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  generateOneTimeToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../src/modules/auth/auth-secrets.js';

test('password hashes use salted Argon2id and reject incorrect passwords', async () => {
  const password = generateOneTimeToken().token;
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.ok(first.startsWith('$argon2id$'));
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(first, password), true);
  assert.equal(await verifyPassword(first, `${password}wrong`), false);
  assert.equal(await verifyPassword(null, password), false);
  assert.equal(await verifyPassword('$argon2id$invalid', password), false);
  assert.equal(await verifyPassword(password, password), false);
});

test('tokens have 256 bits of randomness and only their digest is for storage', () => {
  const first = generateOneTimeToken();
  const second = generateOneTimeToken();
  assert.equal(Buffer.from(first.token, 'base64url').length, 32);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, first.token);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/u);
  assert.equal(first.tokenHash, hashToken(first.token));
  assert.notEqual(first.tokenHash, hashToken(second.token));
  assert.throws(() => hashToken(''));
});
