import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export interface JwtPayload {
  sub: string;
  walletAddress: string;
  role: 'buyer' | 'organizer' | 'admin';
}

const TOKEN_EXPIRY = '7d';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
