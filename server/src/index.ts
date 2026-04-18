import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import {
  userPayloads,
  lastBroadcastTime,
  setLastBroadcastTime,
  userIdToSocket,
  blockedUser,
  blockedIPs,
} from './state.js';
import { setupAuthMiddleware, setupBlockMiddleware } from './middleware.js';
import { registerEventHandlers, rejoinUserIfChatIDExists } from './events.js';
import { registerGameEventHandlers, rejoinGameIfExists } from './gameEvents.js';
import { registerReportHandlers } from './reportEvents.js';
import { broadcastOnlineCount, getSocketByUserId, shouldBroadcast } from './utils.js';
import { signToken, freshPayload, verifyToken } from './tokens.js';
import { BROADCAST_INTERVAL } from './constants.js';
import { ExtendedSocket, FoxPayload } from './types.js';
import { initializeDatabase } from './db.js';
import { syncBlockedUsersFromDb } from './blocklist.js';
import { syncAdminsFromDb } from './adminManager.js';
import { registerAdminHandlers } from './admin.js';
import { authenticateAdmin, verifyAdminToken } from './adminAuth.js';
import {
  submitAppeal,
  updateAppealContent,
  getAppealByUserReport,
  getAppealById,
} from './appeals.js';

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

// Setup JSON body parser
app.use(express.json());

// Setup admin and block middleware
setupAuthMiddleware(io);
setupBlockMiddleware(io);

// Setup admin handlers
registerAdminHandlers(io);

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const result = await authenticateAdmin(username, password);

    if (!result) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    res.json({
      success: true,
      token: result.token,
      adminUserId: result.adminUserId,
      username: result.username,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});

// Verify token endpoint
app.post('/api/admin/verify', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token required' });
    }

    const verified = verifyAdminToken(token);

    if (!verified) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    res.json({ success: true, adminUserId: verified.adminUserId, username: verified.username });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// Check block status for current user
app.get('/api/block-status', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = token ? verifyToken(token) : null;
    const ip = req.ip;

    const blockedUserId = payload?.userId || blockedIPs.get(ip || '') || '';
    const block = blockedUserId ? blockedUser.get(blockedUserId) : null;

    if (!block) {
      return res.json({ blocked: false });
    }

    const isPermanent = block.blockedUntil === Number.MAX_SAFE_INTEGER;
    res.json({
      blocked: true,
      userId: block.userId,
      reason: block.reason || 'Blocked',
      blockedUntil: block.blockedUntil,
      reportId: block.reportId || null,
      isPermanent,
    });
  } catch (err: any) {
    res.status(500).json({ blocked: false, error: 'Failed to check block status' });
  }
});

// Submit an appeal
app.post('/api/appeal', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { reason, message, reportId } = req.body || {};
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Reason is required' });
    }

    const appealId = await submitAppeal({
      userId: payload.userId,
      reportId,
      reason,
      message,
    });

    res.json({ success: true, appealId });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to submit appeal');
    const status = message.includes('already exists') ? 400 : 500;
    res.status(status).json({ success: false, error: message });
  }
});

// Get existing appeal for a report (current user)
app.get('/api/appeal', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const reportId = String(req.query.reportId || '').trim();
    if (!reportId) {
      return res.status(400).json({ success: false, error: 'reportId is required' });
    }

    const appeal = await getAppealByUserReport(payload.userId, reportId);
    if (!appeal) {
      return res.json({ success: true, appeal: null });
    }

    return res.json({ success: true, appeal });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to load appeal' });
  }
});

// Update an existing appeal (current user)
app.put('/api/appeal', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { appealId, reason, message } = req.body || {};
    if (!appealId || !reason) {
      return res.status(400).json({ success: false, error: 'Appeal ID and reason required' });
    }

    const appeal = await getAppealById(appealId);
    if (!appeal || appeal.user_id !== payload.userId) {
      return res.status(403).json({ success: false, error: 'Not allowed' });
    }

    if (appeal.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Appeal can no longer be edited' });
    }

    await updateAppealContent(appealId, payload.userId, reason, message);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update appeal' });
  }
});

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
  registerReportHandlers(io, socket);
});

// Initialize database and start server
(async () => {
  try {
    await initializeDatabase();
    await syncBlockedUsersFromDb();
    await syncAdminsFromDb();

    server.listen(PORT, () => console.log(`🦊 SneakyChat -> http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();
