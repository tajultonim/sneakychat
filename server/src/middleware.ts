import { Server } from 'socket.io';
import type { FoxPayload } from './types';
import { verifyToken, freshPayload } from './tokens';

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
