import { Server } from 'socket.io';
import type { FoxPayload } from './types.js';
import { verifyToken, freshPayload } from './tokens.js';
import { getClientIp } from './events.js';
import { blockedIds, blockedIPs } from './state.js';

export function setupAuthMiddleware(io: Server): void {
  io.use((socket: any, next: any) => {
    const token = socket.handshake.auth.token;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        (socket as any).foxData = payload;
        return next();
      }
    }
    (socket as any).foxData = freshPayload();
    next();
  });
}

export function setupBlockMiddleware(io: Server): void {
  io.use((socket: any, next: any) => {
    const foxData = (socket as any).foxData as FoxPayload;
    const userId = foxData.userId;
    const ip = getClientIp(socket);
    const isBlocked = checkIfBlocked(userId, ip);
    if (isBlocked) {
      console.log(`⛔ Blocked connection attempt from user ${userId} at IP ${ip}`);
      return next(new Error('You are blocked from connecting'));
    }
    next();
  });
}

function checkIfBlocked(userId: string, ip: string): boolean {
  const blockedUsers = blockedIPs.get(ip) || blockedIds.get(userId);
  return !!blockedUsers;
}
