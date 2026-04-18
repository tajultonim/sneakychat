import { Server, Socket } from 'socket.io';
import { MAX_BERRIES, BROADCAST_INTERVAL } from './constants.js';
import { setLastBroadcastTime, userIdToSocket } from './state.js';

export function clamp(n: number): number {
  return Math.min(MAX_BERRIES, Math.max(0, n));
}

export function generateChatId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function getCooldownMs(berries: number): number {
  if (berries >= 50) return 0;
  if (berries >= 40) return 10000;
  if (berries >= 30) return 20000;
  if (berries >= 20) return 30000;
  if (berries >= 10) return 60000;
  if (berries > 0) return 90000;
  return 120000;
}

export function broadcastOnlineCount(io: Server): void {
  io.emit('onlineCount', { count: io.sockets.sockets.size });
  setLastBroadcastTime(Date.now());
}

export function shouldBroadcast(lastBroadcastTime: number): boolean {
  return lastBroadcastTime + BROADCAST_INTERVAL < Date.now();
}

export function getSocketByUserId(io: Server, userId?: string): Socket | null {
  if (!userId) return null;
  const socketId = userIdToSocket.get(userId);
  if (!socketId) return null;
  return io.sockets.sockets.get(socketId) || null;
}
