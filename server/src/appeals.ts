import { v4 as uuid } from 'uuid';
import { getPool } from './db.js';

export interface AppealPayload {
  userId: string;
  reportId?: string;
  reason: string;
  message?: string;
}

export async function submitAppeal(payload: AppealPayload): Promise<string> {
  try {
    const pool = await getPool();
    const appealId = uuid();

    if (payload.reportId) {
      const existing = await getAppealByUserReport(payload.userId, payload.reportId);
      if (existing) {
        await updateAppealContent(
          existing.appeal_id,
          payload.userId,
          payload.reason,
          payload.message
        );
        return existing.appeal_id;
      }
    }

    await pool
      .request()
      .input('appeal_id', appealId)
      .input('user_id', payload.userId)
      .input('report_id', payload.reportId || null)
      .input('reason', payload.reason)
      .input('message', payload.message || '')
      .input('created_at', Date.now()).query(`
        INSERT INTO appeals (
          appeal_id, user_id, report_id, reason, message, created_at, status
        )
        VALUES (
          @appeal_id, @user_id, @report_id, @reason, @message, @created_at, 'pending'
        )
      `);

    console.log(`📝 Appeal submitted: ${appealId} by ${payload.userId}`);
    return appealId;
  } catch (err) {
    console.error('❌ Failed to submit appeal:', err);
    throw err;
  }
}

export async function getAllAppeals(): Promise<any[]> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM appeals ORDER BY created_at DESC
    `);
    return result.recordset;
  } catch (err) {
    console.error('❌ Failed to get appeals:', err);
    throw err;
  }
}

export async function getAppealById(appealId: string): Promise<any | null> {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('appeal_id', appealId)
      .query('SELECT TOP 1 * FROM appeals WHERE appeal_id = @appeal_id');

    return result.recordset[0] || null;
  } catch (err) {
    console.error('❌ Failed to get appeal:', err);
    throw err;
  }
}

export async function getAppealByUserReport(userId: string, reportId: string): Promise<any | null> {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('user_id', userId)
      .input('report_id', reportId)
      .query(
        'SELECT TOP 1 * FROM appeals WHERE user_id = @user_id AND report_id = @report_id ORDER BY created_at DESC'
      );

    return result.recordset[0] || null;
  } catch (err) {
    console.error('❌ Failed to get appeal by report:', err);
    throw err;
  }
}

export async function updateAppealContent(
  appealId: string,
  userId: string,
  reason: string,
  message?: string
): Promise<void> {
  try {
    const pool = await getPool();

    await pool
      .request()
      .input('appeal_id', appealId)
      .input('user_id', userId)
      .input('reason', reason)
      .input('message', message || '')
      .input('updated_at', Date.now()).query(`
        UPDATE appeals
        SET reason = @reason, message = @message, updated_at = @updated_at
        WHERE appeal_id = @appeal_id AND user_id = @user_id AND status = 'pending'
      `);
  } catch (err) {
    console.error('❌ Failed to update appeal:', err);
    throw err;
  }
}

export async function updateAppealStatus(
  appealId: string,
  status: 'pending' | 'approved' | 'rejected',
  reviewedBy?: string
): Promise<void> {
  try {
    const pool = await getPool();

    await pool
      .request()
      .input('appeal_id', appealId)
      .input('status', status)
      .input('reviewed_by', reviewedBy || null)
      .input('reviewed_at', Date.now()).query(`
        UPDATE appeals
        SET status = @status, reviewed_by = @reviewed_by, reviewed_at = @reviewed_at
        WHERE appeal_id = @appeal_id
      `);

    console.log(`📝 Appeal ${appealId} marked as ${status}`);
  } catch (err) {
    console.error('❌ Failed to update appeal:', err);
    throw err;
  }
}

/**
 * Delete an appeal (admin only)
 */
export async function deleteAppeal(appealId: string): Promise<void> {
  try {
    const pool = await getPool();

    await pool.request().input('appeal_id', appealId).query(`
        DELETE FROM appeals WHERE appeal_id = @appeal_id
      `);

    console.log(`🗑️ Appeal ${appealId} deleted`);
  } catch (err) {
    console.error('❌ Failed to delete appeal:', err);
    throw err;
  }
}
