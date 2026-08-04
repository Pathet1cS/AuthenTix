jest.mock('@/config/env', () => ({
  env: { JWT_SECRET: 'test-jwt-secret' },
}));

import jwt from 'jsonwebtoken';
import { signToken, verifyToken, JwtPayload } from './jwt';

const payload: JwtPayload = {
  sub: '665f1a2b3c4d5e6f70819200',
  walletAddress: '0xabcd0000000000000000000000000000000000ff',
  role: 'buyer',
};

describe('signToken / verifyToken', () => {
  it('round-trips the payload claims', () => {
    const decoded = verifyToken(signToken(payload));
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.walletAddress).toBe(payload.walletAddress);
    expect(decoded.role).toBe('buyer');
  });

  it('issues a token expiring in 7 days', () => {
    const decoded = jwt.decode(signToken(payload)) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
  });

  it('throws on a token signed with a different secret', () => {
    const foreign = jwt.sign(payload, 'a-different-secret');
    expect(() => verifyToken(foreign)).toThrow();
  });

  it('throws on an expired token', () => {
    const expired = jwt.sign(payload, 'test-jwt-secret', { expiresIn: '-1s' });
    expect(() => verifyToken(expired)).toThrow();
  });

  it('throws on a malformed token', () => {
    expect(() => verifyToken('not-a-jwt')).toThrow();
  });
});
