import { Server, Socket } from 'socket.io';
import type { QueueEntry, Chat } from './types.js';
import {
  matchmakingQueue,
  activeChats,
  userIdToSocket,
  userIdToChat,
  userPayloads,
} from './state.js';
import { COST_MATCH, INITIAL_CHAT_MS } from './constants.js';
import { clamp, generateChatId, getCooldownMs } from './utils.js';
import { signToken } from './tokens.js';
import { startChatTimer } from './chat.js';

export function removeFromQueue(userId: string): void {
  const idx = matchmakingQueue.findIndex((e) => e.payload.userId === userId);
  if (idx !== -1) matchmakingQueue.splice(idx, 1);
}

export function tryMatch(userId: string): QueueEntry | null {
  const idx = matchmakingQueue.findIndex((e) => e.payload.userId !== userId);
  if (idx === -1) return null;
  return matchmakingQueue.splice(idx, 1)[0];
}

export function requeueSocket(io: Server, userId: string, reason: 'disconnect' | 'skip'): void {
  const payload = userPayloads.get(userId);
  const socketId = userIdToSocket.get(userId);
  const s = socketId ? io.sockets.sockets.get(socketId) : null;
  if (!payload || !s) return;

  if (
    payload.berries < 50 &&
    payload.lastMatch &&
    payload.lastMatch + getCooldownMs(payload.berries) > Date.now()
  ) {
    s.emit('noberries', { msg: 'Fox is tired! Wait for cooldown.' });
    return;
  }

  const partner = tryMatch(userId);
  if (partner) {
    const partnerPayload = partner.payload;
    const partnerSocketId = userIdToSocket.get(partner.payload.userId);
    const partnerSocket = partnerSocketId ? io.sockets.sockets.get(partnerSocketId) : null;

    payload.berries = clamp(payload.berries - COST_MATCH);
    if (partnerPayload) partnerPayload.berries = clamp(partnerPayload.berries - COST_MATCH);

    const chatId = generateChatId();
    activeChats.set(chatId, {
      users: [userId, partner.payload.userId],
      extendVotes: new Set(),
      timer: null,
      phase: 'initial',
      timerEndedAt: null,
      startedAt: Date.now(),
    });
    userIdToChat.set(userId, chatId);
    userIdToChat.set(partner.payload.userId, chatId);
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
      partnerId: partnerSocket?.id,
      userId: userId,
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
        partnerId: s.id,
        userId: partner.payload.userId,
        berries: partnerPayload.berries,
        durationMs: INITIAL_CHAT_MS,
        msg: '🦊 A Sneaky Fox found you! Start chatting!',
      });
    }
    console.log(`💬 Auto-matched ${userId} -> chat ${chatId}`);
  } else {
    matchmakingQueue.push({ socketId: socketId || '', payload });

    s.emit('autoRequeue', {
      msg:
        reason === 'disconnect'
          ? '💨 Fox disconnected — finding another one...'
          : '💨 Fox skipped — finding another one...',
    });

    console.log(`🔄 Auto-requeued: ${userId}`);
  }
}
