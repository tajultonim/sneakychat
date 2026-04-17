import type sql from 'mssql';
import { getPool } from './db.js';
import { blockedIds, blockedIPs, blockedUser } from './state.js';

export interface BlockedUserRecord {
  user_id: string;
  reason: string;
  suspended_until: number;
  created_at: number;
  created_by: string;
  is_permanent: boolean;
  ip_address: string;
}

/**
 * Load all currently active blocked users from database into memory
 */
export async function syncBlockedUsersFromDb(): Promise<void> {
  try {
    const pool = await getPool();
    const result = await pool.request().query<BlockedUserRecord>(`
      SELECT * FROM blocked_users 
      WHERE is_permanent = 1 OR suspended_until > ${Date.now()}
    `);

    // Clear existing in-memory blocks
    blockedIds.clear();
    blockedIPs.clear();
    blockedUser.clear();

    // Load active blocks into memory
    for (const record of result.recordset) {
      const block = {
        userId: record.user_id,
        blockedUntil: record.suspended_until,
        ip: record.ip_address || '',
        userAgent: '',
        reason: record.reason,
        message: record.reason || 'User blocked',
      };

      blockedUser.set(record.user_id, block);
      blockedIds.set(record.user_id, record.user_id);

      if (record.ip_address) {
        blockedIPs.set(record.ip_address, record.user_id);
      }
    }

    console.log(`🛡️  Loaded ${blockedUser.size} blocked users from database`);
  } catch (err) {
    console.error('❌ Failed to sync blocked users:', err);
    throw err;
  }
}

/**
 * Block a user in both database and memory
 */
export async function blockUser(
  userId: string,
  reason?: string,
  duration?: number,
  createdBy?: string,
  ipAddress?: string
): Promise<void> {
  try {
    const pool = await getPool();
    const isPermanent = duration === 0 || !duration;
    const suspendedUntil = isPermanent ? Number.MAX_SAFE_INTEGER : Date.now() + (duration || 0);

    await pool
      .request()
      .input('user_id', userId)
      .input('reason', reason || null)
      .input('suspended_until', suspendedUntil)
      .input('created_at', Date.now())
      .input('created_by', createdBy || null)
      .input('is_permanent', isPermanent ? 1 : 0)
      .input('ip_address', ipAddress || null)
      .query(`
        MERGE INTO blocked_users AS target
        USING (SELECT @user_id AS user_id) AS source
        ON target.user_id = source.user_id
        WHEN MATCHED THEN
          UPDATE SET suspended_until = @suspended_until, reason = @reason
        WHEN NOT MATCHED THEN
          INSERT (user_id, reason, suspended_until, created_at, created_by, is_permanent, ip_address)
          VALUES (@user_id, @reason, @suspended_until, @created_at, @created_by, @is_permanent, @ip_address);
      `);

    // Update in-memory state
    const block = {
      userId,
      blockedUntil: suspendedUntil,
      ip: ipAddress || '',
      userAgent: '',
      reason: reason || null,
      message: reason || 'User blocked',
    };

    blockedUser.set(userId, block);
    blockedIds.set(userId, userId);

    if (ipAddress) {
      blockedIPs.set(ipAddress, userId);
    }

    console.log(`⛔ Blocked user ${userId}${isPermanent ? ' (permanent)' : ` until ${new Date(suspendedUntil)}`}`);
  } catch (err) {
    console.error('❌ Failed to block user:', err);
    throw err;
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(userId: string): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('user_id', userId)
      .query('DELETE FROM blocked_users WHERE user_id = @user_id');

    // Remove from memory
    const block = blockedUser.get(userId);
    if (block) {
      blockedIds.delete(userId);
      blockedIPs.delete(block.ip);
      blockedUser.delete(userId);
    }

    console.log(`✅ Unblocked user ${userId}`);
  } catch (err) {
    console.error('❌ Failed to unblock user:', err);
    throw err;
  }
}

/**
 * Check if user is blocked (considers temporary blocks that may have expired)
 */
export function isUserBlocked(userId: string): boolean {
  const block = blockedUser.get(userId);
  if (!block) return false;

  // Check if temporary block has expired
  if (block.blockedUntil < Number.MAX_SAFE_INTEGER && block.blockedUntil < Date.now()) {
    // Block has expired, remove it
    unblockUser(userId).catch(err => console.error('Failed to remove expired block:', err));
    return false;
  }

  return true;
}

/**
 * Get remaining suspension time in milliseconds
 */
export function getSuspensionTimeRemaining(userId: string): number {
  const block = blockedUser.get(userId);
  if (!block) return 0;

  return Math.max(block.blockedUntil - Date.now(), 0);
}
