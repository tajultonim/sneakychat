// lib/socket.ts
// Singleton socket.io connection.
// Call connectSocket() once in App.svelte onMount.
// Import `socket` anywhere else to emit events.

// socket.io is loaded via a <script> tag in index.html
// declare const window: Window & { io: (url: string, opts?: object) => SocketIOClient };

import { io, Socket } from 'socket.io-client';
import { browser } from '$app/environment';

// interface SocketIOClient {
//   on(event: string, handler: (...args: unknown[]) => void): void;
//   off(event: string, handler: (...args: unknown[]) => void): void;
//   emit(event: string, data?: unknown, callback?: (...args: unknown[]) => void): void;
//   disconnect(): void;
//   id?: string;
//   timeout(ms: number): Promise<void>;
// }

let _socket: Socket | null = null;

export function connectSocket(): Socket {
  const token = browser ? (localStorage.getItem('sneaky_token') ?? undefined) : undefined;
  const adminToken = browser ? (localStorage.getItem('adminToken') ?? undefined) : undefined;
  _socket = io(import.meta.env.VITE_SERVER_URL, { auth: { token, adminToken } });
  return _socket;
}

/** Thin wrapper — safe to import anywhere; no-ops if not yet connected. */
export const socket = {
  emit(event: string, data?: unknown, callback?: (...args: unknown[]) => void): void {
    _socket?.emit(event, data, callback);
  },
  on(event: string, handler: (...args: unknown[]) => void): void {
    _socket?.on(event, handler);
  },
  off(event: string, handler: (...args: unknown[]) => void): void {
    _socket?.off(event, handler);
  },
  get id(): string | undefined {
    return _socket?.id;
  },
  disconnect: () => _socket?.disconnect(),
  emitwithtimeout(event: string, data?: unknown, callback?: (...args: unknown[]) => void): void {
    _socket?.timeout(3000).emit(event, data, callback);
  },
};
