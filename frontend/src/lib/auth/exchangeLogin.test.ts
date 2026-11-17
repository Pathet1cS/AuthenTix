import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exchangeLogin } from './exchangeLogin.ts';
import { buildLoginPayload, serializeLoginPayload } from './loginPayload.ts';

const address = '0xAbC0000000000000000000000000000000000001';
const now = new Date('2026-11-17T00:00:00.000Z');
const nonce = 'n-1';

function fakeAccount() {
  const signed: string[] = [];
  return {
    signed,
    account: {
      address,
      signMessage: async ({ message }: { message: string }) => {
        signed.push(message);
        return '0xsig';
      },
    },
  };
}

const respond = (status: number, body: string) =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

test('signs the serialized payload and posts it', async () => {
  const { account, signed } = fakeAccount();
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ success: true, data: { token: 'jwt-1' } }), { status: 200 });
  }) as unknown as typeof fetch;

  const token = await exchangeLogin({
    account, email: 'radja@x.io', domain: 'localhost:3000', apiUrl: 'http://api', fetchFn, now, nonce,
  });

  const payload = buildLoginPayload({ address, email: 'radja@x.io', domain: 'localhost:3000', nonce, now });
  assert.equal(token, 'jwt-1');
  assert.deepEqual(signed, [serializeLoginPayload(payload)]);
  assert.equal(calls[0].url, 'http://api/api/auth/login');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal((calls[0].init.headers as Record<string, string>)['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { payload, signature: '0xsig' });
});

test('surfaces backend error message', async () => {
  const fetchFn = respond(401, JSON.stringify({ success: false, error: 'Invalid login domain' }));
  await assert.rejects(
    exchangeLogin({ account: fakeAccount().account, email: 'a@b.c', domain: 'd', apiUrl: 'http://api', fetchFn }),
    { message: 'Invalid login domain' },
  );
});

test('falls back to HTTP status when body has no error', async () => {
  const fetchFn = respond(429, 'Too many requests');
  await assert.rejects(
    exchangeLogin({ account: fakeAccount().account, email: 'a@b.c', domain: 'd', apiUrl: 'http://api', fetchFn }),
    { message: 'Login failed (HTTP 429)' },
  );
});

test('rejects a 200 response without a token', async () => {
  const fetchFn = respond(200, JSON.stringify({ success: true, data: {} }));
  await assert.rejects(
    exchangeLogin({ account: fakeAccount().account, email: 'a@b.c', domain: 'd', apiUrl: 'http://api', fetchFn }),
    { message: 'Login failed (HTTP 200)' },
  );
});

test('reports network failure', async () => {
  const fetchFn = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  await assert.rejects(
    exchangeLogin({ account: fakeAccount().account, email: 'a@b.c', domain: 'd', apiUrl: 'http://api', fetchFn }),
    { message: 'Cannot reach the AuthenTix server' },
  );
});
