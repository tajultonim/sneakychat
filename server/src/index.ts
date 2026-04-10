import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import { socketPayloads, lastBroadcastTime, setLastBroadcastTime } from './state.js';
import { setupAuthMiddleware } from './middleware.js';
import { registerEventHandlers } from './events.js';
import { broadcastOnlineCount, shouldBroadcast } from './utils.js';
import { signToken, freshPayload } from './tokens.js';
import { BROADCAST_INTERVAL } from './constants.js';

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

// Setup auth middleware
setupAuthMiddleware(io);

// Track broadcast time
let trackedBroadcastTime = 0;

// Socket.io connection
io.on('connection', (socket) => {
  const ua = socket.handshake.headers['user-agent'];
  const foxData = (socket as any).foxData;
  socketPayloads.set(socket.id, { ...foxData, ua });
  socket.emit('init', {
    token: signToken(foxData),
    berries: foxData.berries,
    activeChatId: foxData.activeChatId || null,
  });

  if (trackedBroadcastTime + BROADCAST_INTERVAL < Date.now()) {
    broadcastOnlineCount(io);
    trackedBroadcastTime = Date.now();
  }

  console.log(`🦊 Connected: ${socket.id} | Online: ${io.sockets.sockets.size}`);

  // Register all event handlers for this socket
  registerEventHandlers(io, socket);
});

// Start server
server.listen(PORT, () => console.log(`🦊 SneakyChat -> http://localhost:${PORT}`));
