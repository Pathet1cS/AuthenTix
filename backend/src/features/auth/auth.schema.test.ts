import { loginRequestSchema, serializeLoginPayload, LoginPayload } from './auth.schema';

const validPayload: LoginPayload = {
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

describe('serializeLoginPayload', () => {
  it('emits the six keys in a fixed order', () => {
    expect(serializeLoginPayload(validPayload)).toBe(
      '{"address":"0xAbCd0000000000000000000000000000000000FF",' +
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
      address: validPayload.address,
      issuedAt: validPayload.issuedAt,
      signature_ignored: 'x',
      nonce: validPayload.nonce,
      email: validPayload.email,
    } as unknown as LoginPayload;

    expect(serializeLoginPayload(shuffled)).toBe(serializeLoginPayload(validPayload));
  });
});
