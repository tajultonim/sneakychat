import { Server } from 'socket.io';
import type { Chat } from './types.js';
import { Timer } from './types.js';
import { activeChats, userIdToSocket, userIdToChat, userPayloads } from './state.js';
import {
  REWARD_TIMER_END,
  REWARD_EXTEND_BONUS,
  REWARD_FINISH,
  EXTENSION_CHAT_MS,
} from './constants.js';
import { clamp } from './utils.js';
import { signToken } from './tokens.js';
import { requeueSocket } from './matchmaking.js';

export function startChatTimer(io: Server, chatId: string, durationMs: number): void {
  const chat = activeChats.get(chatId);
  if (!chat) return;
  if (chat.timer) chat.timer.clear();
  chat.timer = new Timer(() => onTimerEnd(io, chatId), durationMs);
}

export function onTimerEnd(io: Server, chatId: string): void {
  const chat = activeChats.get(chatId);
  if (!chat) return;
  chat.timer = null;
  chat.timerEndedAt = Date.now();
  chat.extendVotes.clear();

  chat.users.forEach((userId) => {
    const p = userPayloads.get(userId);
    const socketId = userIdToSocket.get(userId);
    const s = socketId ? io.sockets.sockets.get(socketId) : null;
    if (!p) return;
    p.berries = clamp(p.berries + REWARD_TIMER_END);
    const t = signToken(p);
    if (s)
      s.emit('timerEnd', {
        token: t,
        berries: p.berries,
        phase: chat.phase,
        msg: "⏰ Time's up! Both foxes earned 5 🍇. Keep going or finish?",
      });
  });
  console.log(`⏰ Timer ended: ${chatId} | phase: ${chat.phase}`);
}

export function endChat(
  io: Server,
  chatId: string,
  initiatorId: string,
  reason: 'complete' | 'skip' | 'disconnect'
): void {
  const chat = activeChats.get(chatId);
  if (!chat) return;
  if (chat.timer) {
    chat.timer.clear();
    chat.timer = null;
  }

  chat.users.forEach((userId) => {
    const p = userPayloads.get(userId);
    const socketId = userIdToSocket.get(userId);
    const s = socketId ? io.sockets.sockets.get(socketId) : null;
    userIdToChat.delete(userId);
    if (!p) return;
    p.activeChatId = null;

    if (reason === 'complete') {
      p.berries = clamp(p.berries + REWARD_FINISH);
      const t = signToken(p);
      if (s)
        s.emit('chatEnded', {
          token: t,
          berries: p.berries,
          reason,
          msg: '🍇 Your Sneaky Fox collected 5 bonus berries for finishing the chat!',
        });
    } else if (reason === 'skip') {
      const t = signToken(p);
      if (userId !== initiatorId) {
        s?.emit('idle', {
          token: t,
          berries: p.berries,
          reason,
          msg: '🦊 The fox snuck away.',
        });
      } else {
        s?.emit('idle', {
          token: t,
          berries: p.berries,
          reason,
          msg: '🦊 You snuck away.',
        });
      }

      if (s) s.emit('berriesUpdate', { token: t, berries: p.berries });
      setImmediate(() => {
        requeueSocket(io, userId, 'skip');
      });
    } else {
      if (userId !== initiatorId) {
        const t = signToken(p);
        if (s) s.emit('berriesUpdate', { token: t, berries: p.berries });
        setImmediate(() => {
          requeueSocket(io, userId, 'disconnect');
        });
      }
    }
  });

  activeChats.delete(chatId);
  console.log(`🔚 Ended: ${chatId} | ${reason}`);
}
