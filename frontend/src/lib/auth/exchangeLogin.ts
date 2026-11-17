import { buildLoginPayload, serializeLoginPayload } from './loginPayload.ts';

type SigningAccount = {
  address: string;
  signMessage(o: { message: string }): Promise<string>;
};

/** Signs a login payload with the connected wallet and trades it for the backend JWT. */
export async function exchangeLogin(args: {
  account: SigningAccount;
  email: string;
  domain: string;
  apiUrl: string;
  fetchFn?: typeof fetch;
  now?: Date;
  nonce?: string;
}): Promise<string> {
  const { account, email, domain, apiUrl, fetchFn = fetch } = args;
  const payload = buildLoginPayload({
    address: account.address,
    email,
    domain,
    nonce: args.nonce ?? crypto.randomUUID(),
    now: args.now ?? new Date(),
  });
  const signature = await account.signMessage({ message: serializeLoginPayload(payload) });

  let res: Response;
  try {
    res = await fetchFn(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, signature }),
    });
  } catch {
    throw new Error('Cannot reach the AuthenTix server');
  }

  const body = await res.json().catch(() => null);
  const token = body?.data?.token;
  if (!res.ok || body?.success !== true || typeof token !== 'string') {
    // App errors send `error` as a string; the rate limiter sends `{ message }`.
    const message = typeof body?.error === 'string' ? body.error : body?.error?.message;
    throw new Error(typeof message === 'string' ? message : `Login failed (HTTP ${res.status})`);
  }
  return token;
}
