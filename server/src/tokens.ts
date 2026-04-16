import jwt from 'jsonwebtoken';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
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

export function decryptMeta(encrypted: string): unknown {
  try {
    const [ivB64, authTagB64, ciphertextB64] = encrypted.split('.');

    const key = createHash('sha256').update(JWT_SECRET).digest();
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    return null;
  }
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
