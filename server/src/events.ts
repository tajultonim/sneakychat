import { Server, Socket } from 'socket.io';
import type { FoxPayload } from './types.js';
import { socketPayloads, socketToChat, activeChats, matchmakingQueue } from './state.js';
import {
  COST_MATCH,
  COST_SKIP,
  REWARD_EXTEND_BONUS,
  INITIAL_CHAT_MS,
  EXTENSION_CHAT_MS,
} from './constants.js';
import { clamp, generateChatId, getCooldownMs } from './utils.js';
import { signToken } from './tokens.js';
import { removeFromQueue, tryMatch, requeueSocket } from './matchmaking.js';
import { startChatTimer, endChat } from './chat.js';
import { getStickerCost } from './stickerCosts.js';

export function registerEventHandlers(io: Server, socket: Socket): void {
  // ── findFox ──────────────────────────────────────────────────────────
  socket.on('findFox', () => {
    const payload = socketPayloads.get(socket.id);
    if (!payload) return;
    if (socketToChat.has(socket.id)) return socket.emit('error', { msg: 'Already in a chat!' });
    if (matchmakingQueue.find((e) => e.socketId === socket.id))
      return socket.emit('error', { msg: 'Already searching...' });
    if (
      payload.berries < 50 &&
      payload.lastMatch &&
      payload.lastMatch + getCooldownMs(payload.berries) > Date.now()
    )
      return socket.emit('noberries', { msg: 'Fox is tired! Wait for cooldown.' });

    const partner = tryMatch(socket.id);
    if (partner) {
      const partnerPayload = socketPayloads.get(partner.socketId);
      const partnerSocket = io.sockets.sockets.get(partner.socketId);

      payload.berries = clamp(payload.berries - COST_MATCH);
      if (partnerPayload) partnerPayload.berries = clamp(partnerPayload.berries - COST_MATCH);

      const chatId = generateChatId();
      activeChats.set(chatId, {
        users: [socket.id, partner.socketId],
        extendVotes: new Set(),
        timer: null,
        phase: 'initial',
        timerEndedAt: null,
        startedAt: Date.now(),
      });
      socketToChat.set(socket.id, chatId);
      socketToChat.set(partner.socketId, chatId);
      payload.activeChatId = chatId;
      payload.lastMatch = Date.now();
      if (partnerPayload) {
        partnerPayload.activeChatId = chatId;
        partnerPayload.lastMatch = Date.now();
      }

      startChatTimer(io, chatId, INITIAL_CHAT_MS);

      socket.emit('matched', {
        token: signToken(payload),
        chatId,
        partnerId: partnerSocket?.id,
        userId: socket.id,
        berries: payload.berries,
        durationMs: INITIAL_CHAT_MS,
        msg: '🦊 You found another Sneaky Fox! Start chatting!',
      });
      socket.emit('partner-status', { status: 'online' });
      partnerSocket?.emit('partner-status', { status: 'online' });

      if (partnerSocket && partnerPayload) {
        partnerSocket.emit('matched', {
          token: signToken(partnerPayload),
          chatId,
          partnerId: partnerSocket.id,
          userId: partner.socketId,
          berries: partnerPayload.berries,
          durationMs: INITIAL_CHAT_MS,
          msg: '🦊 A Sneaky Fox found you! Start chatting!',
        });
      }
      console.log(`💬 Chat ${chatId}: ${socket.id} <-> ${partner.socketId}`);
    } else {
      matchmakingQueue.push({ socketId: socket.id, payload });
      socket.emit('searching', { msg: '🔍 Searching the forest for another fox...' });
      console.log(`🔍 Queued: ${socket.id} | Queue: ${matchmakingQueue.length}`);
    }
  });

  // ── message ────────────────────────────────────────────────────────
  socket.on(
    'message',
    (
      {
        id,
        replyTo,
        text,
        type,
        reaction,
        stickerId,
      }: {
        id: string;
        replyTo?: string;
        text?: string;
        type: 'text' | 'reaction' | 'sticker';
        reaction?: string;
        stickerId?: string;
      },
      callback: (response: any) => void
    ) => {
      if (!callback || typeof callback !== 'function') return;
      if (type === 'text' && (!text || typeof text !== 'string')) return;
      if (type === 'sticker' && !stickerId) return;

      const chatId = socketToChat.get(socket.id);
      if (!chatId) return socket.emit('error', { msg: 'Not in a chat.' });

      const chat = activeChats.get(chatId);
      if (!chat) return;

      const payload = socketPayloads.get(socket.id);
      if (!payload) return;

      // Handle sticker cost deduction
      if (type === 'sticker') {
        if (!stickerId) {
          return callback({ status: 'error', msg: 'Invalid sticker selected.' });
        }
        const cost = getStickerCost(stickerId);
        if (cost === null) {
          return callback({ status: 'error', msg: 'Invalid sticker selected.' });
        }
        if (payload.berries < cost) {
          return callback({ status: 'error', msg: 'Not enough berries for sticker.' });
        }
        if (cost > 0) {
          payload.berries = clamp(payload.berries - cost);
          socket.emit('berriesUpdate', { token: signToken(payload), berries: payload.berries });
        }
      }

      const safeText = type === 'text' || type === 'sticker' ? text?.slice(0, 500) || '' : '';
      const partnerId = chat.users.find((id) => id !== socket.id);
      const partnerSock = partnerId ? io.sockets.sockets.get(partnerId) : null;

      if (partnerSock) {
        partnerSock.emit(
          'message',
          {
            from: 'partner',
            text: safeText,
            id,
            replyTo,
            reaction,
            stickerId,
            type,
            timestamp: Date.now(),
          },
          (response: any) => {
            if (response === 'ok') {
              callback({ status: 'success', timestamp: Date.now() });
            } else {
              callback({ status: 'error', msg: 'Failed to deliver message.' });
            }
          }
        );
        // Echo sticker/reaction messages back to sender
        if (type === 'reaction' || type === 'sticker')
          socket.emit('message', {
            from: 'self',
            text: safeText,
            id,
            replyTo,
            reaction,
            stickerId,
            type,
            timestamp: Date.now(),
          });
      } else {
        socket.emit('message', {
          from: 'self',
          text: safeText,
          id,
          replyTo,
          reaction,
          stickerId,
          type,
        });
        callback({ status: 'error', msg: 'Your partner is offline. Message not delivered.' });
      }
    }
  );

  // ── extendChat ──────────────────────────────────────────────────────
  socket.on('extendChat', () => {
    const chatId = socketToChat.get(socket.id);
    if (!chatId) return socket.emit('error', { msg: 'Not in a chat.' });
    const chat = activeChats.get(chatId);
    if (!chat) return;
    if (!chat.timerEndedAt) return socket.emit('info', { msg: '⏳ Timer is still running!' });
    if (chat.extendVotes.has(socket.id))
      return socket.emit('info', { msg: 'You already voted to extend!' });
    chat.extendVotes.add(socket.id);
    const partnerId = chat.users.find((id) => id !== socket.id);
    const partnerSock = partnerId ? io.sockets.sockets.get(partnerId) : null;
    if (partnerSock)
      partnerSock.emit('extendRequest', {
        msg: '🍇 The other fox wants to keep chatting! Agree to extend?',
      });
    socket.emit('info', { msg: '⏳ Waiting for the other fox to agree...' });
    if (chat.extendVotes.size === 2) {
      chat.extendVotes.clear();
      chat.phase = 'extended';
      chat.timerEndedAt = null;
      chat.users.forEach((uid) => {
        const p = socketPayloads.get(uid);
        const s = io.sockets.sockets.get(uid);
        if (!p) return;
        p.berries = clamp(p.berries + REWARD_EXTEND_BONUS);
        const t = signToken(p);
        if (s)
          s.emit('chatExtended', {
            token: t,
            berries: p.berries,
            durationMs: EXTENSION_CHAT_MS,
            msg: '🍇 Both foxes agree! +5 berries each. 5 more minutes!',
          });
      });
      startChatTimer(io, chatId, EXTENSION_CHAT_MS);
      console.log(`🔄 Extended: ${chatId}`);
    }
  });

  // ── chatComplete ────────────────────────────────────────────────────
  socket.on('chatComplete', () => {
    const chatId = socketToChat.get(socket.id);
    if (!chatId) return;
    const chat = activeChats.get(chatId);
    if (!chat) return;
    if (!chat.timerEndedAt) return socket.emit('info', { msg: "⏳ Chat timer hasn't ended yet!" });
    endChat(io, chatId, socket.id, 'complete');
  });

  // ── skip ─────────────────────────────────────────────────────────────
  socket.on('skip', () => {
    const payload = socketPayloads.get(socket.id);
    if (!payload) return;
    const chatId = socketToChat.get(socket.id);

    if (chatId) {
      payload.berries = clamp(payload.berries - COST_SKIP);
      socket.emit('berriesUpdate', { token: signToken(payload), berries: payload.berries });
      endChat(io, chatId, socket.id, 'skip');
    } else {
      removeFromQueue(socket.id);
      socket.emit('idle', { msg: '🦊 You stopped searching.' });
    }
  });

  // ── disconnect ──────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    removeFromQueue(socket.id);
    const chatId = socketToChat.get(socket.id);
    const chat = activeChats.get(chatId || '');
    if (!chat) return;
    const partnerId = chat.users.find((id) => id !== socket.id);
    const partnerSock = partnerId ? io.sockets.sockets.get(partnerId) : null;
    if (partnerSock) {
      partnerSock.emit('partner-status', { status: 'offline' });
      partnerSock.emit('message', {
        type: 'system',
        text: '💨 Your partner disappeared! Waiting to see if they come back...\n or skip to find a new fox.',
        timestamp: Date.now(),
      });
    } else {
      endChat(io, chatId || '', socket.id, 'disconnect');
    }
    socketPayloads.delete(socket.id);
    console.log(`👋 Left: ${socket.id} | Online: ${io.sockets.sockets.size}`);
  });

  // ── typing ─────────────────────────────────────────────────────────
  socket.on('typing', ({ isTyping }: { isTyping: boolean }) => {
    const chatId = socketToChat.get(socket.id);
    if (!chatId) return;
    const chat = activeChats.get(chatId);
    if (!chat) return;
    const partnerId = chat.users.find((id) => id !== socket.id);
    const partnerSock = partnerId ? io.sockets.sockets.get(partnerId) : null;
    if (partnerSock)
      partnerSock.emit('partner-status', {
        status: isTyping ? 'typing' : 'online',
      });
  });

  // ── rejoinRoom ─────────────────────────────────────────────────────
  socket.on(
    'rejoinRoom',
    ({ roomId, ouid }: { roomId: string; ouid: string }, callback: (response: any) => void) => {
      if (!callback || typeof callback !== 'function') return;
      const chatId = roomId;
      const chat = activeChats.get(chatId);
      if (!chat) return callback({ msg: 'Chat not found.', status: 'error' });
      if (!chat.timer) return callback({ msg: 'Chat timed out.', status: 'error' });

      console.log(chat.users, ouid, socket.id);
      if (!chat.users.includes(ouid)) {
        return callback({
          msg: 'You were not part of this chat.',
          status: 'error',
        });
      }

      let partnerId = chat.users.find((id) => id !== ouid);
      if (!partnerId) return callback({ msg: 'Partner not found.', status: 'error' });
      let partnerSock = io.sockets.sockets.get(partnerId);
      if (!partnerSock) return callback({ msg: 'Partner not found.', status: 'error' });

      activeChats.set(chatId, { ...chat, users: [socket.id, partnerSock.id] });
      socketToChat.set(socket.id, chatId);
      socketToChat.set(partnerSock.id, chatId);
      const payload = socketPayloads.get(socket.id);
      if (payload) {
        payload.activeChatId = roomId;
        callback({
          chatId,
          partnerId: partnerSock.id,
          userId: socket.id,
          status: 'success',
          token: signToken(payload),
          berries: payload.berries,
          msg: '🦊 You rejoined the chat!',
          timeEndAt: chat.timer?.endAt || 0,
        });
        partnerSock.emit('partner-status', { status: 'online', event: 'rejoined' });
        socket.emit('partner-status', { status: 'online', event: 'rejoined' });
        partnerSock.emit('message', {
          type: 'system',
          text: '🦊 Your partner rejoined the chat!',
          timestamp: Date.now(),
        });
        socket.emit('message', {
          type: 'system',
          text: '🦊 Your rejoined the chat!',
          timestamp: Date.now(),
        });
      }
    }
  );

  // ── exitChat ────────────────────────────────────────────────────────
  socket.on('exitChat', () => {
    removeFromQueue(socket.id);
    const chatId = socketToChat.get(socket.id);
    if (chatId) endChat(io, chatId, socket.id, 'disconnect');
    socket.emit('idle', { msg: '🦊 You left the chat.' });
  });
}
