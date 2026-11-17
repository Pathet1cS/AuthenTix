import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLoginPayload, nameFromEmail, serializeLoginPayload } from './loginPayload.ts';

test('serializeLoginPayload uses backend key order', () => {
  const p = buildLoginPayload({
    address: '0xAbC0000000000000000000000000000000000001',
    email: 'radja@x.io',
    domain: 'localhost:3000',
    nonce: 'n-1',
    now: new Date('2026-11-17T00:00:00.000Z'),
  });
  assert.equal(
    serializeLoginPayload(p),
    '{"domain":"localhost:3000","statement":"Sign in to AuthenTix","address":"0xAbC0000000000000000000000000000000000001","email":"radja@x.io","name":"radja","nonce":"n-1","issuedAt":"2026-11-17T00:00:00.000Z","expiresAt":"2026-11-17T00:05:00.000Z"}',
  );
});

test('serializeLoginPayload ignores the object key order it was given', () => {
  const p = buildLoginPayload({
    address: '0x1', email: 'a@b.c', domain: 'd', nonce: 'n', now: new Date(0),
  });
  const shuffled = Object.fromEntries(Object.entries(p).reverse()) as typeof p;
  assert.equal(serializeLoginPayload(shuffled), serializeLoginPayload(p));
});

test('nameFromEmail caps at 100 chars', () => {
  assert.equal(nameFromEmail('a'.repeat(150) + '@x.io').length, 100);
});

test('nameFromEmail falls back when the local part is empty', () => {
  assert.equal(nameFromEmail('@x.io'), 'AuthenTix User');
});
