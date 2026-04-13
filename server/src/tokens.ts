import jwt from 'jsonwebtoken';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import type { FoxPayload } from './types.js';
import { STARTING_BERRIES } from './constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sneaky-fox-berry-secret-change-in-prod';

export function encryptMeta(payload: unknown): string {
  const key = createHash('sha256').update(JWT_SECRET).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.'
  );
}

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
