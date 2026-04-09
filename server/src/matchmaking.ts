import { Server, Socket } from 'socket.io';
import type { QueueEntry, Chat } from './types';
import {
  matchmakingQueue,
  activeChats,
  socketToChat,
  socketPayloads,
} from './state';
import {
  COST_MATCH,
  INITIAL_CHAT_MS,
} from './constants';
import { clamp, generateChatId, getCooldownMs } from './utils';
import { signToken } from './tokens';
import { startChatTimer } from './chat';

export function removeFromQueue(socketId: string): void {
  const idx = matchmakingQueue.findIndex((e) => e.socketId === socketId);
  if (idx !== -1) matchmakingQueue.splice(idx, 1);
}

export function tryMatch(socketId: string): QueueEntry | null {
  const idx = matchmakingQueue.findIndex((e) => e.socketId !== socketId);
  if (idx === -1) return null;
  return matchmakingQueue.splice(idx, 1)[0];
}

export function requeueSocket(io: Server, socketId: string, reason: 'disconnect' | 'skip'): void {
  const payload = socketPayloads.get(socketId);
  const s = io.sockets.sockets.get(socketId);
  if (!payload || !s) return;

  if (
    payload.berries < 50 &&
    payload.lastMatch &&
    payload.lastMatch + getCooldownMs(payload.berries) > Date.now()
  ) {
    s.emit('noberries', { msg: 'Fox is tired! Wait for cooldown.' });
    return;
  }

  const partner = tryMatch(socketId);
  if (partner) {
    const partnerPayload = socketPayloads.get(partner.socketId);
    const partnerSocket = io.sockets.sockets.get(partner.socketId);

    payload.berries = clamp(payload.berries - COST_MATCH);
    if (partnerPayload) partnerPayload.berries = clamp(partnerPayload.berries - COST_MATCH);

    const chatId = generateChatId();
    activeChats.set(chatId, {
      users: [socketId, partner.socketId],
      extendVotes: new Set(),
      timer: null,
      phase: 'initial',
      timerEndedAt: null,
      startedAt: Date.now(),
    });
    socketToChat.set(socketId, chatId);
    socketToChat.set(partner.socketId, chatId);
    payload.activeChatId = chatId;
    payload.lastMatch = Date.now();
    if (partnerPayload) {
      partnerPayload.activeChatId = chatId;
      partnerPayload.lastMatch = Date.now();
    }

    startChatTimer(io, chatId, INITIAL_CHAT_MS);

    s.emit('matched', {
      token: signToken(payload),
      chatId,
      partnerId: partner.socketId,
      userId: socketId,
      berries: payload.berries,
      durationMs: INITIAL_CHAT_MS,
      msg: '🦊 Found a new Sneaky Fox! Start chatting!',
    });
    s.emit('partner-status', { status: 'online' });
    partnerSocket?.emit('partner-status', { status: 'online' });

    if (partnerSocket && partnerPayload) {
      partnerSocket.emit('matched', {
        token: signToken(partnerPayload),
        chatId,
        partnerId: socketId,
        userId: partner.socketId,
        berries: partnerPayload.berries,
        durationMs: INITIAL_CHAT_MS,
        msg: '🦊 A Sneaky Fox found you! Start chatting!',
      });
    }
    console.log(`💬 Auto-matched ${socketId} -> chat ${chatId}`);
  } else {
    matchmakingQueue.push({ socketId, payload });

    s.emit('autoRequeue', {
      msg:
        reason === 'disconnect'
          ? '💨 Fox disconnected — finding another one...'
          : '💨 Fox skipped — finding another one...',
    });

    console.log(`🔄 Auto-requeued: ${socketId}`);
  }
}
