import {
  loginRequestSchema,
  serializeLoginPayload,
  LOGIN_STATEMENT,
  LoginPayload,
} from './auth.schema';

const validPayload: LoginPayload = {
  domain: 'localhost:3000',
  statement: LOGIN_STATEMENT,
  address: '0xAbCd0000000000000000000000000000000000FF',
  email: 'user@example.com',
  name: 'Alice',
  nonce: 'a1b2c3',
  issuedAt: '2026-08-04T10:00:00.000Z',
  expiresAt: '2026-08-04T10:05:00.000Z',
};

const validRequest = { payload: validPayload, signature: '0xdeadbeef' };

describe('loginRequestSchema', () => {
  it('accepts a well-formed request', () => {
    expect(loginRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it('rejects a client-supplied role', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, role: 'admin' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an address that is not 20 hex bytes', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, address: '0x123' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, email: 'not-an-email' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO issuedAt', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, issuedAt: '04-08-2026' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, name: '' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-hex signature', () => {
    const result = loginRequestSchema.safeParse({ ...validRequest, signature: 'nope' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level fields', () => {
    const result = loginRequestSchema.safeParse({ ...validRequest, extra: true });
    expect(result.success).toBe(false);
  });
});

describe('loginRequestSchema — domain and statement', () => {
  it('requires a domain', () => {
    const { domain: _domain, ...withoutDomain } = validPayload;
    const result = loginRequestSchema.safeParse({ ...validRequest, payload: withoutDomain });
    expect(result.success).toBe(false);
  });

  it('rejects an empty domain', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, domain: '' },
    });
    expect(result.success).toBe(false);
  });

  it('requires a statement', () => {
    const { statement: _statement, ...withoutStatement } = validPayload;
    const result = loginRequestSchema.safeParse({ ...validRequest, payload: withoutStatement });
    expect(result.success).toBe(false);
  });

  it('rejects an empty statement', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, statement: '' },
    });
    expect(result.success).toBe(false);
  });

  it('exports the canonical statement text', () => {
    expect(LOGIN_STATEMENT).toBe('Sign in to AuthenTix');
  });
});

describe('loginRequestSchema — input bounds', () => {
  it('rejects a name longer than 100 characters', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, name: 'a'.repeat(101) },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a name of exactly 100 characters', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, name: 'a'.repeat(100) },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a nonce longer than 128 characters', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, nonce: 'a'.repeat(129) },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an email longer than 254 characters', () => {
    const long = `${'a'.repeat(250)}@example.com`;
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, email: long },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a domain longer than 253 characters', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, domain: 'a'.repeat(254) },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a statement longer than 200 characters', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      payload: { ...validPayload, statement: 'a'.repeat(201) },
    });
    expect(result.success).toBe(false);
  });
});

describe('loginRequestSchema — signature bounds', () => {
  it('rejects an odd-length hex signature', () => {
    // 0x + 5 nibbles: cannot be a whole number of bytes.
    const result = loginRequestSchema.safeParse({ ...validRequest, signature: '0xabcde' });
    expect(result.success).toBe(false);
  });

  it('rejects a bare 0x signature with no bytes', () => {
    const result = loginRequestSchema.safeParse({ ...validRequest, signature: '0x' });
    expect(result.success).toBe(false);
  });

  it('accepts an even-length hex signature', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      signature: `0x${'ab'.repeat(65)}`,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a signature longer than 10000 characters', () => {
    const result = loginRequestSchema.safeParse({
      ...validRequest,
      signature: `0x${'ab'.repeat(5000)}`,
    });
    expect(result.success).toBe(false);
  });
});

describe('serializeLoginPayload', () => {
  it('emits the eight keys in a fixed order, domain first', () => {
    expect(serializeLoginPayload(validPayload)).toBe(
      '{"domain":"localhost:3000",' +
        '"statement":"Sign in to AuthenTix",' +
        '"address":"0xAbCd0000000000000000000000000000000000FF",' +
        '"email":"user@example.com",' +
        '"name":"Alice",' +
        '"nonce":"a1b2c3",' +
        '"issuedAt":"2026-08-04T10:00:00.000Z",' +
        '"expiresAt":"2026-08-04T10:05:00.000Z"}',
    );
  });

  it('is independent of the input object key order', () => {
    const shuffled = {
      expiresAt: validPayload.expiresAt,
      name: validPayload.name,
      statement: validPayload.statement,
      address: validPayload.address,
      issuedAt: validPayload.issuedAt,
      signature_ignored: 'x',
      nonce: validPayload.nonce,
      domain: validPayload.domain,
      email: validPayload.email,
    } as unknown as LoginPayload;

    expect(serializeLoginPayload(shuffled)).toBe(serializeLoginPayload(validPayload));
  });
});
