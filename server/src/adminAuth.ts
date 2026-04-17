import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPool } from './db.js';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin-secret-change-in-production';
const JWT_EXPIRY = '24h';

// Wildcard admin from environment
const WILDCARD_ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const WILDCARD_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

export interface AdminCredentials {
  id: number;
  adminUserId: string;
  username: string;
  lastLogin: number | null;
  isActive: boolean;
}

export interface AdminAuthToken {
  adminUserId: string;
  username: string;
  iat: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for admin
 */
export function generateAdminToken(adminUserId: string, username: string): string {
  return jwt.sign(
    { adminUserId, username },
    ADMIN_JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify JWT token
 */
export function verifyAdminToken(token: string): AdminAuthToken | null {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as AdminAuthToken;
  } catch (err) {
    return null;
  }
}

/**
 * Authenticate admin with username and password
 * Checks wildcard admin first, then database
 */
export async function authenticateAdmin(
  username: string,
  password: string
): Promise<{ token: string; adminUserId: string; username: string } | null> {
  try {
    // Check wildcard admin from environment first
    if (WILDCARD_ADMIN_USERNAME && WILDCARD_ADMIN_PASSWORD) {
      if (username === WILDCARD_ADMIN_USERNAME && password === WILDCARD_ADMIN_PASSWORD) {
        const token = generateAdminToken('wildcard-admin', username);
        console.log(`✅ Wildcard admin login: ${username}`);
        return {
          token,
          adminUserId: 'wildcard-admin',
          username: username,
        };
      }
    }

    // Check database credentials next
    const pool = await getPool();

    const result = await pool
      .request()
      .input('username', username)
      .query(`
        SELECT ac.id, ac.admin_user_id, ac.username, ac.password_hash, ac.is_active, a.is_active as admin_active
        FROM admin_credentials ac
        JOIN admins a ON ac.admin_user_id = a.user_id
        WHERE ac.username = @username AND ac.is_active = 1 AND a.is_active = 1
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const record = result.recordset[0];
    const passwordMatch = await verifyPassword(password, record.password_hash);

    if (!passwordMatch) {
      return null;
    }

    // Update last login
    await pool
      .request()
      .input('id', record.id)
      .input('last_login', Date.now())
      .query(`UPDATE admin_credentials SET last_login = @last_login WHERE id = @id`);

    const token = generateAdminToken(record.admin_user_id, record.username);

    console.log(`✅ Database admin login: ${username}`);

    return {
      token,
      adminUserId: record.admin_user_id,
      username: record.username,
    };
  } catch (err: any) {
    console.error('❌ Authentication error:', err);
    return null;
  }
}

/**
 * Register admin credentials (only for superadmins creating new admins)
 */
export async function registerAdminCredentials(
  adminUserId: string,
  username: string,
  password: string
): Promise<void> {
  try {
    const pool = await getPool();
    const passwordHash = await hashPassword(password);

    await pool
      .request()
      .input('admin_user_id', adminUserId)
      .input('username', username)
      .input('password_hash', passwordHash)
      .input('created_at', Date.now())
      .input('is_active', 1)
      .query(`
        INSERT INTO admin_credentials (admin_user_id, username, password_hash, created_at, is_active)
        VALUES (@admin_user_id, @username, @password_hash, @created_at, @is_active)
      `);

    console.log(`🔐 Registered admin credentials for ${username}`);
  } catch (err: any) {
    console.error('❌ Failed to register admin credentials:', err);
    throw err;
  }
}

/**
 * Update admin password
 */
export async function updateAdminPassword(
  adminUserId: string,
  newPassword: string
): Promise<void> {
  try {
    const pool = await getPool();
    const passwordHash = await hashPassword(newPassword);

    await pool
      .request()
      .input('admin_user_id', adminUserId)
      .input('password_hash', passwordHash)
      .query(`
        UPDATE admin_credentials
        SET password_hash = @password_hash
        WHERE admin_user_id = @admin_user_id
      `);

    console.log(`🔐 Updated password for admin ${adminUserId}`);
  } catch (err: any) {
    console.error('❌ Failed to update password:', err);
    throw err;
  }
}

/**
 * Deactivate admin credentials
 */
export async function deactivateAdminCredentials(adminUserId: string): Promise<void> {
  try {
    const pool = await getPool();

    await pool
      .request()
      .input('admin_user_id', adminUserId)
      .query(`UPDATE admin_credentials SET is_active = 0 WHERE admin_user_id = @admin_user_id`);

    console.log(`🔐 Deactivated credentials for ${adminUserId}`);
  } catch (err: any) {
    console.error('❌ Failed to deactivate credentials:', err);
    throw err;
  }
}

/**
 * Check if admin has credentials set up
 */
export async function hasAdminCredentials(adminUserId: string): Promise<boolean> {
  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('admin_user_id', adminUserId)
      .query(`
        SELECT COUNT(*) as count FROM admin_credentials
        WHERE admin_user_id = @admin_user_id AND is_active = 1
      `);

    return result.recordset[0].count > 0;
  } catch (err) {
    console.error('❌ Failed to check credentials:', err);
    return false;
  }
}
