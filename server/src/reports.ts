import { v4 as uuid } from 'uuid';
import { getPool } from './db.js';
import { decryptMeta } from './tokens.js';

export interface ReportPayload {
  chatId: string;
  messageId: string;
  reason: string;
  reporterId: string;
  encryptedMeta?: string;
  conversationEncryptedMeta?: string[];
}

type DecryptedMessageMeta = {
  chatId?: string;
  messageId?: string;
  senderId?: string;
  senderIp?: string;
  userAgent?: string;
  sentAt?: number;
  text?: string;
  type?: string;
  reaction?: string;
  stickerId?: string;
  replyTo?: string;
};

type ConversationEntry = {
  index: number;
  messageId: string | null;
  senderId: string | null;
  sentAt: number | null;
  type: string | null;
  text: string | null;
  reaction: string | null;
  stickerId: string | null;
  replyTo: string | null;
  userAgent: string | null;
  senderIp: string | null;
};

function normalizeMeta(index: number, meta: DecryptedMessageMeta | null): ConversationEntry {
  return {
    index,
    messageId: meta?.messageId ?? null,
    senderId: meta?.senderId ?? null,
    sentAt: typeof meta?.sentAt === 'number' ? meta.sentAt : null,
    type: meta?.type ?? null,
    text: meta?.text ?? null,
    reaction: meta?.reaction ?? null,
    stickerId: meta?.stickerId ?? null,
    replyTo: meta?.replyTo ?? null,
    userAgent: meta?.userAgent ?? null,
    senderIp: meta?.senderIp ?? null,
  };
}

function buildConversationContext(encryptedConversation: string[]): {
  entries: ConversationEntry[];
  decryptedMessages: DecryptedMessageMeta[];
} {
  const decryptedMessages: DecryptedMessageMeta[] = [];
  const entries = encryptedConversation.map((encrypted, index) => {
    const meta = decryptMeta(encrypted) as DecryptedMessageMeta | null;
    if (meta) {
      decryptedMessages.push(meta);
    }
    return normalizeMeta(index, meta);
  });

  return { entries, decryptedMessages };
}

/**
 * Check if a chat has already been reported
 */
export async function hasReportedChat(chatId: string): Promise<boolean> {
  try {
    const pool = await getPool();
    const result = await pool.request().input('chat_id', chatId).query(`
        SELECT COUNT(*) as count FROM reports
        WHERE chat_id = @chat_id AND status != 'dismissed'
      `);

    return result.recordset[0].count > 0;
  } catch (err) {
    console.error('❌ Failed to check reported chat:', err);
    throw err;
  }
}

/**
 * Submit a report for a message
 */
export async function submitReport(payload: ReportPayload): Promise<string> {
  try {
    const pool = await getPool();

    // Check if this chat has already been reported
    const alreadyReported = await hasReportedChat(payload.chatId);
    if (alreadyReported) {
      throw new Error('This chat has already been reported');
    }

    const reportId = uuid();

    const encryptedConversation = Array.isArray(payload.conversationEncryptedMeta)
      ? payload.conversationEncryptedMeta.filter((item) => typeof item === 'string')
      : [];
    const { entries, decryptedMessages } = buildConversationContext(encryptedConversation);

    let reportedMessageMeta: DecryptedMessageMeta | null = null;
    if (payload.messageId) {
      reportedMessageMeta =
        decryptedMessages.find((meta) => meta?.messageId === payload.messageId) || null;
    }

    if (!reportedMessageMeta && payload.encryptedMeta) {
      reportedMessageMeta = decryptMeta(payload.encryptedMeta) as DecryptedMessageMeta | null;
    }

    let reportedUserId = reportedMessageMeta?.senderId || 'unknown-user';

    const metaJson = reportedMessageMeta ? JSON.stringify(reportedMessageMeta) : '';
    const conversationJson = JSON.stringify({
      version: 1,
      messages: entries,
    });

    await pool
      .request()
      .input('report_id', reportId)
      .input('reporter_id', payload.reporterId)
      .input('reported_user_id', reportedUserId)
      .input('chat_id', payload.chatId)
      .input('message_id', payload.messageId)
      .input('message_text', reportedMessageMeta?.text || '')
      .input('reason', payload.reason)
      .input('message_meta', metaJson)
      .input('conversation_context', conversationJson)
      .input('reported_at', Date.now()).query(`
        INSERT INTO reports (
          report_id, reporter_id, reported_user_id, chat_id, message_id,
          message_text, reason, message_meta, conversation_context, reported_at, status
        )
        VALUES (
          @report_id, @reporter_id, @reported_user_id, @chat_id, @message_id,
          @message_text, @reason, @message_meta, @conversation_context, @reported_at, 'pending'
        )
      `);

    console.log(
      `📋 Report submitted: ${reportId} by ${payload.reporterId} against ${reportedUserId}`
    );
    return reportId;
  } catch (err: any) {
    console.error('❌ Failed to submit report:', err);
    throw err;
  }
}

/**
 * Get all pending reports (admin only)
 */
export async function getPendingReports(): Promise<any[]> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM reports WHERE status = 'pending' ORDER BY reported_at DESC
    `);

    return result.recordset;
  } catch (err) {
    console.error('❌ Failed to get reports:', err);
    throw err;
  }
}

/**
 * Get all reports (admin only)
 */
export async function getAllReports(): Promise<any[]> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM reports ORDER BY reported_at DESC
    `);

    return result.recordset;
  } catch (err) {
    console.error('❌ Failed to get reports:', err);
    throw err;
  }
}

/**
 * Update report status (admin only)
 */
export async function updateReportStatus(
  reportId: string,
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned',
  reviewedBy?: string
): Promise<void> {
  try {
    const pool = await getPool();

    await pool
      .request()
      .input('report_id', reportId)
      .input('status', status)
      .input('reviewed_by', reviewedBy || null)
      .input('reviewed_at', Date.now()).query(`
        UPDATE reports
        SET status = @status, reviewed_by = @reviewed_by, reviewed_at = @reviewed_at
        WHERE report_id = @report_id
      `);

    console.log(`📋 Report ${reportId} marked as ${status}`);
  } catch (err) {
    console.error('❌ Failed to update report:', err);
    throw err;
  }
}
