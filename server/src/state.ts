import type { QueueEntry, Chat, FoxPayload } from './types.js';

export const matchmakingQueue: QueueEntry[] = [];
export const activeChats = new Map<string, Chat>();
export const socketToChat = new Map<string, string>();
export const socketPayloads = new Map<string, FoxPayload>();

export let lastBroadcastTime = 0;

export function setLastBroadcastTime(time: number): void {
  lastBroadcastTime = time;
}
