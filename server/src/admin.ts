import { Server } from 'socket.io';
import { blockUser, unblockUser } from './blocklist.js';
import { blockedUser } from './state.js';
import { isAdmin, isSuperAdmin, addAdmin, removeAdmin, updateAdminRole, getAllAdmins } from './adminManager.js';
import { verifyAdminToken } from './adminAuth.js';
import type { Block } from './types.js';

function checkAdminToken(socket: any): { valid: boolean; adminUserId?: string } {
  const token = socket.handshake.auth.adminToken;
  
  if (!token) {
    return { valid: false };
  }

  const verified = verifyAdminToken(token);
  if (!verified) {
    return { valid: false };
  }

  return { valid: true, adminUserId: verified.adminUserId };
}

function getBlockedUsersList(): any[] {
  const blocked: any[] = [];
  blockedUser.forEach((block: Block) => {
    const timeRemaining = block.blockedUntil - Date.now();
    blocked.push({
      userId: block.userId,
      reason: block.reason,
      blockedUntil: block.blockedUntil,
      timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
      isPermanent: block.blockedUntil === Number.MAX_SAFE_INTEGER,
    });
  });
  return blocked.sort((a, b) => b.blockedUntil - a.blockedUntil);
}

function broadcastBlockedUsersUpdate(io: Server): void {
  const blockedList = getBlockedUsersList();
  io.emit('admin:blockedUsersUpdated', { data: blockedList });
}

export function registerAdminHandlers(io: Server): void {
  io.on('connection', (socket: any) => {
    // Get all blocked users
    socket.on('admin:getBlockedUsers', (callback?: (data: any) => void) => {
      const authCheck = checkAdminToken(socket);
      if (!authCheck.valid) {
        callback?.({ error: 'Not authorized' });
        return;
      }

      const blocked = getBlockedUsersList();
      callback?.({ data: blocked });
    });

    // Block a user
    socket.on('admin:blockUser', async (data: any, callback?: (response: any) => void) => {
      const authCheck = checkAdminToken(socket);
      if (!authCheck.valid || !authCheck.adminUserId) {
        callback?.({ success: false, error: 'Not authorized' });
        return;
      }

      try {
        const { userId, reason, durationHours = 0, ip } = data;

        if (!userId) {
          callback?.({ success: false, error: 'User ID is required' });
          return;
        }

        const duration = durationHours > 0 ? durationHours * 60 * 60 * 1000 : 0;
        await blockUser(
          userId,
          reason || 'User blocked by admin',
          duration,
          authCheck.adminUserId,
          ip
        );

        console.log(`👮 Admin ${authCheck.adminUserId} blocked user ${userId}`);
        callback?.({
          success: true,
          message: `User ${userId} has been ${durationHours > 0 ? `blocked for ${durationHours} hours` : 'permanently blocked'}`,
        });

        // Disconnect the user if they're online
        disconnectUser(io, userId);

        // Broadcast update to all admins
        broadcastBlockedUsersUpdate(io);
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // Unblock a user
    socket.on('admin:unblockUser', async (data: any, callback?: (response: any) => void) => {
      const authCheck = checkAdminToken(socket);
      if (!authCheck.valid || !authCheck.adminUserId) {
        callback?.({ success: false, error: 'Not authorized' });
        return;
      }

      try {
        const { userId } = data;

        if (!userId) {
          callback?.({ success: false, error: 'User ID is required' });
          return;
        }

        await unblockUser(userId);

        console.log(`👮 Admin ${authCheck.adminUserId} unblocked user ${userId}`);
        callback?.({ success: true, message: `User ${userId} has been unblocked` });

        // Broadcast update to all admins
        broadcastBlockedUsersUpdate(io);
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // Get all admins (superadmin only)
    socket.on('admin:getAllAdmins', (callback?: (data: any) => void) => {
      const authCheck = checkAdminToken(socket);
      if (!authCheck.valid || !authCheck.adminUserId) {
        callback?.({ error: 'Not authorized' });
        return;
      }

      // Check if superadmin
      if (!isSuperAdmin(authCheck.adminUserId)) {
        callback?.({ error: 'Only superadmins can view admin list' });
        return;
      }

      const admins = getAllAdmins();
      callback?.({ data: admins });
    });

    // Add an admin (superadmin only)
    socket.on('admin:addAdmin', async (data: any, callback?: (response: any) => void) => {
      const authCheck = checkAdminToken(socket);
      if (!authCheck.valid || !authCheck.adminUserId) {
        callback?.({ success: false, error: 'Not authorized' });
        return;
      }

      if (!isSuperAdmin(authCheck.adminUserId)) {
        callback?.({ success: false, error: 'Only superadmins can add admins' });
        return;
      }

      try {
        const { userId, role = 'moderator' } = data;

        if (!userId) {
          callback?.({ success: false, error: 'User ID is required' });
          return;
        }

        if (!['superadmin', 'moderator'].includes(role)) {
          callback?.({ success: false, error: 'Invalid role' });
          return;
        }

        await addAdmin(userId, role, authCheck.adminUserId);

        console.log(`👮 Superadmin ${authCheck.adminUserId} added ${role} ${userId}`);
        callback?.({ success: true, message: `${userId} is now a ${role}` });

        // Broadcast admin list update
        const admins = getAllAdmins();
        io.emit('admin:adminsUpdated', { data: admins });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // Remove an admin (superadmin only)
    socket.on('admin:removeAdmin', async (data: any, callback?: (response: any) => void) => {
      const authCheck = checkAdminToken(socket);
      if (!authCheck.valid || !authCheck.adminUserId) {
        callback?.({ success: false, error: 'Not authorized' });
        return;
      }

      if (!isSuperAdmin(authCheck.adminUserId)) {
        callback?.({ success: false, error: 'Only superadmins can remove admins' });
        return;
      }

      try {
        const { userId } = data;

        if (!userId) {
          callback?.({ success: false, error: 'User ID is required' });
          return;
        }

        await removeAdmin(userId);

        console.log(`👮 Superadmin ${authCheck.adminUserId} removed admin ${userId}`);
        callback?.({ success: true, message: `${userId} is no longer an admin` });

        // Broadcast admin list update
        const admins = getAllAdmins();
        io.emit('admin:adminsUpdated', { data: admins });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // Update admin role (superadmin only)
    socket.on('admin:updateAdminRole', async (data: any, callback?: (response: any) => void) => {
      const authCheck = checkAdminToken(socket);
      if (!authCheck.valid || !authCheck.adminUserId) {
        callback?.({ success: false, error: 'Not authorized' });
        return;
      }

      if (!isSuperAdmin(authCheck.adminUserId)) {
        callback?.({ success: false, error: 'Only superadmins can update admin roles' });
        return;
      }

      try {
        const { userId, role } = data;

        if (!userId || !role) {
          callback?.({ success: false, error: 'User ID and role are required' });
          return;
        }

        if (!['superadmin', 'moderator'].includes(role)) {
          callback?.({ success: false, error: 'Invalid role' });
          return;
        }

        await updateAdminRole(userId, role);

        console.log(`👮 Superadmin ${authCheck.adminUserId} updated ${userId} to ${role}`);
        callback?.({ success: true, message: `${userId} is now a ${role}` });

        // Broadcast admin list update
        const admins = getAllAdmins();
        io.emit('admin:adminsUpdated', { data: admins });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });
  });
}

function disconnectUser(io: Server, userId: string): void {
  for (const socket of io.sockets.sockets.values()) {
    if ((socket as any).foxData?.userId === userId) {
      socket.emit('banned', { message: 'You have been blocked from the service' });
      socket.disconnect(true);
    }
  }
}
