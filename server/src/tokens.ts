import jwt from 'jsonwebtoken';
import type { FoxPayload } from './types.js';
import { STARTING_BERRIES } from './constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sneaky-fox-berry-secret-change-in-prod';

export function signToken(payload: FoxPayload): string {
  const { iat, ...rest } = payload;
  return jwt.sign(rest, JWT_SECRET);
}

export function verifyToken(token: string): FoxPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as FoxPayload;
  } catch {
    return null;
  }
}

export function freshPayload(overrides: Partial<FoxPayload> = {}): FoxPayload {
  return { berries: STARTING_BERRIES, lastMatch: null, activeChatId: null, ...overrides };
}
