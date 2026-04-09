import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import { socketPayloads, lastBroadcastTime, setLastBroadcastTime } from './state';
import { setupAuthMiddleware } from './middleware';
import { registerEventHandlers } from './events';
import { broadcastOnlineCount, shouldBroadcast } from './utils';
import { signToken, freshPayload } from './tokens';
import { BROADCAST_INTERVAL } from './constants';

const JWT_SECRET = process.env.JWT_SECRET || 'sneaky-fox-berry-secret-change-in-prod';
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

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
