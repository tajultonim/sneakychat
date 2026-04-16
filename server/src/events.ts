import { Server, Socket } from 'socket.io';
import type { ExtendedSocket, FoxPayload } from './types.js';
import {
  activeChats,
  matchmakingQueue,
  userIdToSocket,
  userIdToChat,
  userPayloads,
} from './state.js';
import {
  COST_MATCH,
  COST_SKIP,
  REWARD_EXTEND_BONUS,
  INITIAL_CHAT_MS,
  EXTENSION_CHAT_MS,
} from './constants.js';
import { clamp, generateChatId, getCooldownMs, getSocketByUserId } from './utils.js';
import { encryptMeta, signToken } from './tokens.js';
import { removeFromQueue, tryMatch, requeueSocket } from './matchmaking.js';
import { startChatTimer, endChat } from './chat.js';
import { getStickerCost } from './stickerCosts.js';

export function getClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return socket.handshake.address || socket.conn.remoteAddress || 'unknown';
}

export function registerEventHandlers(io: Server, socket: ExtendedSocket): void {
  // ── findFox ──────────────────────────────────────────────────────────
  socket.on('findFox', () => {
    if (!socket.foxData) return;
    if (userIdToChat.has(socket.foxData.userId))
      return socket.emit('error', { msg: 'Already connected!' });

    if (matchmakingQueue.find((e) => e.payload.userId === socket.foxData.userId))
      return socket.emit('error', { msg: 'Already searching...' });
    if (
      socket.foxData.berries < 50 &&
      socket.foxData.lastMatch &&
      socket.foxData.lastMatch + getCooldownMs(socket.foxData.berries) > Date.now()
    )
      return socket.emit('noberries', { msg: 'Fox is tired! Wait for cooldown.' });

    const partner = tryMatch(socket.foxData.userId);
    if (partner) {
      const partnerPayload = partner.payload;
      const partnerSocket = getSocketByUserId(io, partner.payload.userId);

      socket.foxData.berries = clamp(socket.foxData.berries - COST_MATCH);
      if (partnerPayload) partnerPayload.berries = clamp(partnerPayload.berries - COST_MATCH);

      const chatId = generateChatId();
      activeChats.set(chatId, {
        users: [socket.foxData.userId, partner.payload.userId],
        extendVotes: new Set(),
        timer: null,
        phase: 'initial',
        timerEndedAt: null,
        startedAt: Date.now(),
      });

      userIdToChat.set(socket.foxData.userId, chatId);
      userIdToChat.set(partner.payload.userId, chatId);

      socket.foxData.activeChatId = chatId;
      socket.foxData.lastMatch = Date.now();
      if (partnerPayload) {
        partnerPayload.activeChatId = chatId;
        partnerPayload.lastMatch = Date.now();
      }

      startChatTimer(io, chatId, INITIAL_CHAT_MS);

      socket.emit('matched', {
        token: signToken(socket.foxData),
        chatId,
        partnerId: partnerSocket?.id,
        userId: socket.foxData.userId,
        berries: socket.foxData.berries,
        durationMs: INITIAL_CHAT_MS,
        msg: '🦊 You found another Sneaky Fox! Start chatting!',
      });
      socket.emit('partner-status', { status: 'online' });
      partnerSocket?.emit('partner-status', { status: 'online' });

      if (partnerSocket && partnerPayload) {
        partnerSocket.emit('matched', {
          token: signToken(partnerPayload),
          chatId,
          partnerId: socket.id,
          userId: partner.payload.userId,
          berries: partnerPayload.berries,
          durationMs: INITIAL_CHAT_MS,
          msg: '🦊 A Sneaky Fox found you! Start chatting!',
        });
      }
      console.log(`💬 Chat ${chatId}: ${socket.foxData.userId} <-> ${partner.payload.userId}`);
    } else {
      matchmakingQueue.push({ socketId: socket.id, payload: socket.foxData });
      socket.emit('searching', { msg: '🔍 Searching the forest for another fox...' });
      console.log(`🔍 Queued: ${socket.foxData.userId} | Queue: ${matchmakingQueue.length}`);
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

      const chatId = userIdToChat.get(socket.foxData?.userId || '');
      if (!chatId) return socket.emit('error', { msg: 'Not in a chat.' });

      const chat = activeChats.get(chatId);
      if (!chat) return;

      const payload = userPayloads.get(socket.foxData?.userId || '');
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
      const meta = encryptMeta({
        chatId,
        messageId: id,
        senderId: socket.foxData?.userId,
        senderIp: getClientIp(socket),
        userAgent: payload.ua || socket.handshake.headers['user-agent'] || 'unknown',
        sentAt: Date.now(),
        text: safeText,
        type,
        reaction,
        stickerId,
        replyTo,
      });

      const partnerId = chat.users.find((userId) => userId !== socket.foxData?.userId);
      const partnerSock = getSocketByUserId(io, partnerId);

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
            meta,
          },
          (response: any) => {
            if (response === 'ok') {
              callback({ status: 'success', timestamp: Date.now(), meta });
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
            meta,
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
          meta,
        });
        callback({ status: 'error', msg: 'Your partner is offline. Message not delivered.', meta });
      }
    }
  );

  // ── extendChat ──────────────────────────────────────────────────────
  socket.on('extendChat', () => {
    const chatId = userIdToChat.get(socket.foxData?.userId || '');
    if (!chatId) return socket.emit('error', { msg: 'Not in a chat.' });
    const chat = activeChats.get(chatId);
    if (!chat) return;
    if (!chat.timerEndedAt) return socket.emit('info', { msg: '⏳ Timer is still running!' });
    if (chat.extendVotes.has(socket.foxData?.userId || ''))
      return socket.emit('info', { msg: 'You already voted to extend!' });
    chat.extendVotes.add(socket.foxData?.userId || '');
    const partnerId = chat.users.find((userId) => userId !== socket.foxData?.userId);
   
    const partnerSock = getSocketByUserId(io, partnerId);
    if (partnerSock)
      partnerSock.emit('extendRequest', {
        msg: '🍇 The other fox wants to keep chatting! Agree to extend?',
      });
    socket.emit('info', { msg: '⏳ Waiting for the other fox to agree...' });
    if (chat.extendVotes.size === 2) {
      chat.extendVotes.clear();
      chat.phase = 'extended';
      chat.timerEndedAt = null;
      chat.users.forEach((userId) => {
        const p = userPayloads.get(userId);
        const s = getSocketByUserId(io, userId);
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
    const chatId = userIdToChat.get(socket.foxData?.userId || '');
    if (!chatId) return;
    const chat = activeChats.get(chatId);
    if (!chat) return;
    if (!chat.timerEndedAt) return socket.emit('info', { msg: "⏳ Chat timer hasn't ended yet!" });
    endChat(io, chatId, socket.foxData?.userId || '', 'complete');
  });

  // ── skip ─────────────────────────────────────────────────────────────
  socket.on('skip', () => {
    const payload = userPayloads.get(socket.foxData?.userId || '');
    if (!payload) return;
    const chatId = userIdToChat.get(socket.foxData?.userId || '');

    if (chatId) {
      payload.berries = clamp(payload.berries - COST_SKIP);
      socket.emit('berriesUpdate', { token: signToken(payload), berries: payload.berries });
      endChat(io, chatId, socket.foxData?.userId || '', 'skip');
    } else {
      removeFromQueue(socket.foxData?.userId || '');
      socket.emit('idle', { msg: '🦊 You stopped searching.' });
    }
  });

  // ── disconnect ──────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const userId = socket.foxData?.userId;
    if (!userId) return;
    removeFromQueue(userId);
    const chatId = userIdToChat.get(userId);
    const chat = activeChats.get(chatId || '');
    if (!chat) return;
    const partnerId = chat.users.find((uid) => uid !== userId);
    const partnerSock = getSocketByUserId(io, partnerId);
    if (partnerSock) {
      partnerSock.emit('partner-status', { status: 'offline' });
      partnerSock.emit('message', {
        type: 'system',
        text: '💨 Your partner disappeared! Waiting to see if they come back...\n or skip to find a new fox.',
        timestamp: Date.now(),
      });
    } else {
      endChat(io, chatId || '', userId, 'disconnect');
    }
    userPayloads.delete(userId);
    userIdToSocket.delete(userId);
    console.log(`👋 Left: ${userId} | Online: ${io.sockets.sockets.size}`);
  });

  // ── typing ─────────────────────────────────────────────────────────
  socket.on('typing', ({ isTyping }: { isTyping: boolean }) => {
    const chatId = userIdToChat.get(socket.foxData?.userId || '');
    if (!chatId) return;
    const chat = activeChats.get(chatId);
    if (!chat) return;
    const partnerId = chat.users.find((userId) => userId !== socket.foxData?.userId);
    const partnerSock = getSocketByUserId(io, partnerId);
    if (partnerSock)
      partnerSock.emit('partner-status', {
        status: isTyping ? 'typing' : 'online',
      });
  });

  // ── exitChat ────────────────────────────────────────────────────────
  socket.on('exitChat', () => {
    const userId = socket.foxData?.userId;
    if (!userId) return;
    removeFromQueue(userId);
    const chatId = userIdToChat.get(userId);
    if (chatId) endChat(io, chatId, userId, 'disconnect');
    socket.emit('idle', { msg: '🦊 You left the chat.' });
  });
}

export function rejoinUserIfChatIDExists(io: Server, socket: ExtendedSocket): void {
  const foxData = socket.foxData;
  if (!foxData || !foxData.userId) return;

  userIdToSocket.set(foxData.userId, socket.id);

  if (foxData.activeChatId) {
    console.log(foxData.activeChatId);
    const chatId = foxData.activeChatId;
    const chat = activeChats.get(chatId);
    if (chat) {
      const partnerId = chat.users.find((userId) => userId !== foxData.userId);
      const partnerSock = getSocketByUserId(io, partnerId);
      if (partnerSock) {
        activeChats.set(chatId, { ...chat, users: [foxData.userId, partnerId || ''] });
        userIdToChat.set(foxData.userId, chatId);
        if (partnerId) userIdToChat.set(partnerId, chatId);
        socket.emit('partner-status', { status: 'online', event: 'rejoined' });
        partnerSock.emit('partner-status', { status: 'online', event: 'rejoined' });

        socket.emit('rejoinRoom', {
          chatId,
          status: 'success',
          msg: '🦊 You rejoined the chat!',
          timeEndAt: chat.timer?.endAt || 0,
        });

        socket.emit('message', {
          type: 'system',
          text: '🦊 You rejoined the chat!',
          timestamp: Date.now(),
        });
        partnerSock.emit('message', {
          type: 'system',
          text: '🦊 Your partner rejoined the chat!',
          timestamp: Date.now(),
        });
        console.log(`🔄 Rejoined: ${chatId} | User: ${foxData.userId}`);
      }
    }
  }
}
