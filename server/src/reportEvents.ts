import { Server, Socket } from 'socket.io';
import type { ExtendedSocket } from './types.js';
import { submitReport } from './reports.js';

export function registerReportHandlers(io: Server, socket: ExtendedSocket): void {
  socket.on('report:message', async (data: any, callback?: (response: any) => void) => {
    try {
      if (!socket.foxData) {
        callback?.({ success: false, error: 'Not authenticated' });
        return;
      }

      const {
        chatId,
        messageId,
        messageText,
        reason,
        encryptedMeta,
        conversationEncryptedMeta,
        conversationContext,
        reportedUserId,
      } = data;

      if (!chatId || !messageId || !reason) {
        callback?.({ success: false, error: 'Missing required fields' });
        return;
      }

      const safeConversation = Array.isArray(conversationEncryptedMeta)
        ? conversationEncryptedMeta.filter((item) => typeof item === 'string')
        : [];

      const reportId = await submitReport({
        reporterId: socket.foxData.userId,
        chatId,
        messageId,
        reason,
        encryptedMeta,
        conversationEncryptedMeta: safeConversation,
      });

      console.log(
        `📋 User ${socket.foxData.userId} reported message ${messageId} by ${reportedUserId}`
      );
      callback?.({ success: true, reportId, message: 'Report submitted successfully' });
    } catch (err: any) {
      console.error('❌ Error submitting report:', err);
      callback?.({ success: false, error: err.message || 'Failed to submit report' });
    }
  });
}
