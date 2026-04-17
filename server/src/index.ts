import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import { userPayloads, lastBroadcastTime, setLastBroadcastTime, userIdToSocket } from './state.js';
import { setupAuthMiddleware, setupBlockMiddleware } from './middleware.js';
import { registerEventHandlers, rejoinUserIfChatIDExists } from './events.js';
import { registerGameEventHandlers, rejoinGameIfExists } from './gameEvents.js';
import { broadcastOnlineCount, getSocketByUserId, shouldBroadcast } from './utils.js';
import { signToken, freshPayload } from './tokens.js';
import { BROADCAST_INTERVAL } from './constants.js';
import { ExtendedSocket, FoxPayload } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sneaky-fox-berry-secret-change-in-prod';
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const corsConfig = {
  origin: IS_PRODUCTION ? SITE_URL : true,
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsConfig,
});

// Setup CORS middleware for Express
app.use(cors(corsConfig));

// Setup auth and block middleware
setupAuthMiddleware(io);
setupBlockMiddleware(io);

// Track broadcast time
let trackedBroadcastTime = 0;

// Socket.io connection
io.on('connection', (skt) => {
  const socket = skt as ExtendedSocket;
  const ua = socket.handshake.headers['user-agent'];
  const foxData = socket.foxData;
  const oldSocketId = userIdToSocket.get(foxData.userId);
  const oldSocket = oldSocketId ? io.sockets.sockets.get(oldSocketId) : null;

  if (oldSocket) {
    oldSocket.emit('info', { msg: 'You have been disconnected due to a new connection.' });
    oldSocket.disconnect();
  }

  userPayloads.set(foxData.userId, { ...foxData, ua });
  userIdToSocket.set(foxData.userId, socket.id);

  socket.emit('init', {
    token: signToken(foxData),
    berries: foxData.berries,
    activeChatId: foxData.activeChatId || null,
    userId: foxData.userId,
  });

  if (trackedBroadcastTime + BROADCAST_INTERVAL < Date.now()) {
    broadcastOnlineCount(io);
    trackedBroadcastTime = Date.now();
  }

  console.log(`🦊 Connected: ${foxData.userId} | Online: ${io.sockets.sockets.size}`);

  rejoinUserIfChatIDExists(io, socket);
  rejoinGameIfExists(io, socket);
  registerEventHandlers(io, socket);
  registerGameEventHandlers(io, socket);
});

// Start server
server.listen(PORT, () => console.log(`🦊 SneakyChat -> http://localhost:${PORT}`));
