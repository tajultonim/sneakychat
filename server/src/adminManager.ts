import { getPool } from './db.js';

export type AdminRole = 'superadmin' | 'moderator';

const WILDCARD_ADMIN_ID = 'wildcard-admin';

export interface AdminUser {
  userId: string;
  role: AdminRole;
  createdAt: number;
  createdBy: string | null;
  isActive: boolean;
}

// In-memory cache of admins
const adminCache = new Map<string, AdminUser>();

/**
 * Load all active admins from database into memory
 */
export async function syncAdminsFromDb(): Promise<void> {
  try {
    const pool = await getPool();
    const result = await pool.request().query<AdminUser>(`
      SELECT user_id, role, created_at, created_by, is_active
      FROM admins 
      WHERE is_active = 1
    `);

    adminCache.clear();

    for (const record of result.recordset) {
      const admin: AdminUser = {
        userId: record.userId,
        role: record.role as AdminRole,
        createdAt: record.createdAt,
        createdBy: record.createdBy,
        isActive: record.isActive,
      };
      adminCache.set(record.userId, admin);
    }

    console.log(`👮 Loaded ${adminCache.size} admins from database`);
  } catch (err) {
    console.error('❌ Failed to sync admins:', err);
    throw err;
  }
}

/**
 * Get admin info
 */
export function getAdmin(userId: string): AdminUser | undefined {
  return adminCache.get(userId);
}

/**
 * Check if user is admin
 */
export function isAdmin(userId: string): boolean {
  if (userId === WILDCARD_ADMIN_ID) return true;
  return adminCache.has(userId);
}

/**
 * Check if user is superadmin
 */
export function isSuperAdmin(userId: string): boolean {
  if (userId === WILDCARD_ADMIN_ID) return true;
  const admin = adminCache.get(userId);
  return admin?.role === 'superadmin' && admin.isActive;
}

/**
 * Get all admins
 */
export function getAllAdmins(): AdminUser[] {
  return Array.from(adminCache.values());
}

/**
 * Add an admin
 */
export async function addAdmin(
  userId: string,
  role: AdminRole = 'moderator',
  createdBy?: string
): Promise<void> {
  try {
    const pool = await getPool();

    await pool
      .request()
      .input('user_id', userId)
      .input('role', role)
      .input('created_at', Date.now())
      .input('created_by', createdBy || null)
      .input('is_active', 1).query(`
        MERGE INTO admins AS target
        USING (SELECT @user_id AS user_id) AS source
        ON target.user_id = source.user_id
        WHEN MATCHED THEN
          UPDATE SET role = @role, is_active = 1
        WHEN NOT MATCHED THEN
          INSERT (user_id, role, created_at, created_by, is_active)
          VALUES (@user_id, @role, @created_at, @created_by, @is_active)
      `);

    // Update cache
    adminCache.set(userId, {
      userId,
      role,
      createdAt: Date.now(),
      createdBy: createdBy || null,
      isActive: true,
    });

    console.log(`👮 Added ${role} admin: ${userId}`);
  } catch (err) {
    console.error('❌ Failed to add admin:', err);
    throw err;
  }
}

/**
 * Remove an admin
 */
export async function removeAdmin(userId: string): Promise<void> {
  try {
    const pool = await getPool();

    await pool
      .request()
      .input('user_id', userId)
      .query(`UPDATE admins SET is_active = 0 WHERE user_id = @user_id`);

    adminCache.delete(userId);

    console.log(`👮 Removed admin: ${userId}`);
  } catch (err) {
    console.error('❌ Failed to remove admin:', err);
    throw err;
  }
}

/**
 * Update admin role
 */
export async function updateAdminRole(userId: string, newRole: AdminRole): Promise<void> {
  try {
    const pool = await getPool();

    await pool
      .request()
      .input('user_id', userId)
      .input('role', newRole)
      .query(`UPDATE admins SET role = @role WHERE user_id = @user_id`);

    // Update cache
    const admin = adminCache.get(userId);
    if (admin) {
      admin.role = newRole;
    }

    console.log(`👮 Updated ${userId} to ${newRole}`);
  } catch (err) {
    console.error('❌ Failed to update admin role:', err);
    throw err;
  }
}
