import { v4 as uuid } from 'uuid';
import { getPool } from './db.js';

type NoticeRecord = {
  notice_id: string;
  content: string;
  created_at: number;
  created_by: string;
  is_active: boolean;
  expires_at?: number | null;
};

export async function getActiveNotice(): Promise<NoticeRecord | null> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT TOP 1 *
        FROM notices
        WHERE is_active = 1
          AND (expires_at IS NULL OR expires_at > ${Date.now()})
        ORDER BY created_at DESC
      `);

    return result.recordset[0] || null;
  } catch (err) {
    console.error('❌ Failed to get active notice:', err);
    throw err;
  }
}

export async function setNotice(
  content: string,
  createdBy: string,
  expiresAt?: number | null
): Promise<NoticeRecord> {
  try {
    const pool = await getPool();
    const noticeId = uuid();
    const createdAt = Date.now();

    await pool.request().query(`
        UPDATE notices SET is_active = 0 WHERE is_active = 1
      `);

    await pool
      .request()
      .input('notice_id', noticeId)
      .input('content', content)
      .input('created_at', createdAt)
      .input('created_by', createdBy)
      .input('expires_at', expiresAt ?? null)
      .input('is_active', 1).query(`
        INSERT INTO notices (notice_id, content, created_at, created_by, expires_at, is_active)
        VALUES (@notice_id, @content, @created_at, @created_by, @expires_at, @is_active)
      `);

    return {
      notice_id: noticeId,
      content,
      created_at: createdAt,
      created_by: createdBy,
      expires_at: expiresAt ?? null,
      is_active: true,
    };
  } catch (err) {
    console.error('❌ Failed to set notice:', err);
    throw err;
  }
}

export async function clearNotice(): Promise<void> {
  try {
    const pool = await getPool();
    await pool.request().query(`
        UPDATE notices SET is_active = 0 WHERE is_active = 1
      `);
  } catch (err) {
    console.error('❌ Failed to clear notice:', err);
    throw err;
  }
}
