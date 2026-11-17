import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSession, isSessionValidFor } from './session.ts';

const b64url = (s: string) =>
  Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeJwt = (claims: object) => `h.${b64url(JSON.stringify(claims))}.s`;

const claims = {
  sub: 'u1',
  walletAddress: '0xabc0000000000000000000000000000000000001',
  role: 'organizer',
  exp: 2_000_000_000,
};

test('decodeSession reads claims', () => {
  const token = fakeJwt(claims);
  assert.deepEqual(decodeSession(token), {
    token,
    userId: 'u1',
    walletAddress: claims.walletAddress,
    role: 'organizer',
    expiresAt: 2_000_000_000_000,
  });
});

test('decodeSession handles base64url chars', () => {
  // '??>' encodes to '-'/'_' in base64url and needs padding restored.
  const withUrlChars = { ...claims, extra: '??>>~~' };
  const segment = b64url(JSON.stringify(withUrlChars));
  assert.match(segment, /[-_]/);
  assert.equal(decodeSession(fakeJwt(withUrlChars))?.userId, 'u1');
});

test('decodeSession returns null for garbage', () => {
  assert.equal(decodeSession('garbage'), null);
  assert.equal(decodeSession('a.b.c'), null);
  assert.equal(decodeSession(''), null);
});

test('decodeSession returns null when role is missing or unknown', () => {
  const { role: _role, ...noRole } = claims;
  assert.equal(decodeSession(fakeJwt(noRole)), null);
  assert.equal(decodeSession(fakeJwt({ ...claims, role: 'root' })), null);
});

test('valid for same address in different case', () => {
  assert.equal(
    isSessionValidFor(decodeSession(fakeJwt(claims)), '0xABC0000000000000000000000000000000000001', 0),
    true,
  );
});

test('invalid for another address', () => {
  assert.equal(
    isSessionValidFor(decodeSession(fakeJwt(claims)), '0xabc0000000000000000000000000000000000002', 0),
    false,
  );
});

test('invalid when expired', () => {
  assert.equal(
    isSessionValidFor(decodeSession(fakeJwt(claims)), claims.walletAddress, 2_000_000_000_000),
    false,
  );
});

test('invalid for null session', () => {
  assert.equal(isSessionValidFor(null, claims.walletAddress, 0), false);
});
