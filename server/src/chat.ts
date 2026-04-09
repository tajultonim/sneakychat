import { Server } from 'socket.io';
import type { Chat } from './types';
import { Timer } from './types';
import { activeChats, socketToChat, socketPayloads } from './state';
import {
  REWARD_TIMER_END,
  REWARD_EXTEND_BONUS,
  REWARD_FINISH,
  EXTENSION_CHAT_MS,
} from './constants';
import { clamp } from './utils';
import { signToken } from './tokens';

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

  chat.users.forEach((uid) => {
    const p = socketPayloads.get(uid);
    const s = io.sockets.sockets.get(uid);
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
  reason: 'complete' | 'skip' | 'disconnect',
): void {
  const chat = activeChats.get(chatId);
  if (!chat) return;
  if (chat.timer) {
    chat.timer.clear();
    chat.timer = null;
  }

  chat.users.forEach((uid) => {
    const p = socketPayloads.get(uid);
    const s = io.sockets.sockets.get(uid);
    socketToChat.delete(uid);
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
      if (uid !== initiatorId) {
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
        const { requeueSocket } = require('./matchmaking');
        requeueSocket(io, uid, 'skip');
      });
    } else {
      if (uid !== initiatorId) {
        const t = signToken(p);
        if (s) s.emit('berriesUpdate', { token: t, berries: p.berries });
        setImmediate(() => {
          const { requeueSocket } = require('./matchmaking');
          requeueSocket(io, uid, 'disconnect');
        });
      }
    }
  });

  activeChats.delete(chatId);
  console.log(`🔚 Ended: ${chatId} | ${reason}`);
}
