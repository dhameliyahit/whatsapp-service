import { whatsappSessionService } from './whatsappSession.service';
import { WhatsAppMessage, IWhatsAppMessageDocument } from '../models/whatsappMessage.model';
import { webhookService } from './webhook.service';

export interface SendMessageOptions {
  userId: string;
  to: string;
  content: string;
  sessionId?: string;
}

export interface SendOtpOptions {
  userId: string;
  to: string;
  code: string;
  brandName?: string;
  message?: string;
  sessionId?: string;
}

export class WhatsAppMessageService {
  // Serial dispatch queue per session to prevent concurrent message bursts (Anti-Ban)
  private sessionQueues: Map<string, Promise<any>> = new Map();

  /**
   * Enqueues a message dispatch task to ensure strict serial pacing and safe jitter delays
   */
  private async enqueueTask<T>(sessionKey: string, task: () => Promise<T>): Promise<T> {
    const currentQueue = this.sessionQueues.get(sessionKey) || Promise.resolve();

    const nextTask = currentQueue
      .then(async () => {
        return await task();
      })
      .catch((err) => {
        // Log task error but allow queue to continue processing next messages
        console.error(`:-> [WhatsApp Queue] Task error on session ${sessionKey}:`, err?.message || err);
        throw err;
      });

    // Update queue pointer
    this.sessionQueues.set(
      sessionKey,
      nextTask.catch(() => {})
    );

    return nextTask;
  }

  /**
   * Computes human-like typing delay based on message length (400ms - 2000ms)
   */
  private computeTypingDuration(text: string, isOtp: boolean = false): number {
    if (isOtp) {
      // Faster typing simulation for time-sensitive OTP verification
      return 350;
    }
    const baseTime = text.length * 20;
    const jitter = Math.floor(Math.random() * 400);
    return Math.min(2000, Math.max(500, baseTime + jitter));
  }

  /**
   * Generates safe cooldown delay between consecutive messages (1000ms - 2500ms)
   */
  private getPacingDelay(isOtp: boolean = false): number {
    if (isOtp) {
      // 400ms - 700ms cooldown for OTP
      return 400 + Math.floor(Math.random() * 300);
    }
    // 1500ms - 2800ms jittered delay for bulk/standard messages to prevent account bans
    return 1500 + Math.floor(Math.random() * 1300);
  }

  /**
   * Sanitizes and normalizes destination phone number into WhatsApp JID
   */
  normalizePhoneNumber(phone: string): { cleanNumber: string; jid: string } {
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 8 || digits.length > 16) {
      throw new Error(`Invalid phone number format: '${phone}'. Must include country code without symbols.`);
    }

    const jid = `${digits}@s.whatsapp.net`;
    return { cleanNumber: digits, jid };
  }

  /**
   * Send a standard text message with anti-ban pacing and human typing simulation
   */
  async sendMessage(options: SendMessageOptions): Promise<IWhatsAppMessageDocument> {
    const { userId, to, content, sessionId = 'primary' } = options;
    const sessionKey = `${userId}_${sessionId}`;
    const { cleanNumber, jid } = this.normalizePhoneNumber(to);

    return this.enqueueTask(sessionKey, async () => {
      const sock = whatsappSessionService.getSocket(userId, sessionId);
      if (!sock) {
        throw new Error(`WhatsApp session '${sessionId}' is not connected. Please scan the QR code first.`);
      }

      // Record queued message in DB
      const messageDoc = new WhatsAppMessage({
        userId,
        sessionId,
        to: cleanNumber,
        type: 'text',
        content,
        status: 'queued',
      });
      await messageDoc.save();

      try {
        // 1. Simulate human presence & typing indicator
        const typingDuration = this.computeTypingDuration(content, false);
        try {
          await sock.presenceSubscribe(jid);
          await sock.sendPresenceUpdate('composing', jid);
          await new Promise((res) => setTimeout(res, typingDuration));
          await sock.sendPresenceUpdate('paused', jid);
        } catch {
          // Presence errors do not block dispatch
        }

        // 2. Dispatch message through Baileys
        const sentResult = await sock.sendMessage(jid, { text: content });

        if (!sentResult?.key?.id) {
          throw new Error('Message dispatch failed: No message ID returned by WhatsApp.');
        }

        messageDoc.messageId = sentResult.key.id;
        messageDoc.status = 'sent';
        messageDoc.sentAt = new Date();
        await messageDoc.save();

        webhookService.dispatchEvent(userId, 'message.sent', {
          messageId: messageDoc.messageId,
          to: messageDoc.to,
          type: messageDoc.type,
          sentAt: messageDoc.sentAt,
        });

        // 3. Apply safe anti-ban pacing delay before allowing next message in queue
        const cooldown = this.getPacingDelay(false);
        await new Promise((res) => setTimeout(res, cooldown));

        return messageDoc;
      } catch (error: any) {
        messageDoc.status = 'failed';
        messageDoc.error = error.message || 'Unknown dispatch error';
        await messageDoc.save();

        webhookService.dispatchEvent(userId, 'message.failed', {
          to: cleanNumber,
          error: messageDoc.error,
          type: messageDoc.type,
        });

        throw new Error(`WhatsApp delivery failed: ${error.message}`);
      }
    });
  }

  /**
   * Send high-priority OTP verification message with fast delivery & enterprise template
   */
  async sendOtp(options: SendOtpOptions): Promise<IWhatsAppMessageDocument> {
    const { userId, to, code, brandName = 'Verifinder', message, sessionId = 'primary' } = options;
    const sessionKey = `${userId}_${sessionId}`;
    const { cleanNumber, jid } = this.normalizePhoneNumber(to);

    return this.enqueueTask(sessionKey, async () => {
      const sock = whatsappSessionService.getSocket(userId, sessionId);
      if (!sock) {
        throw new Error(`WhatsApp session '${sessionId}' is not connected. Please link your WhatsApp first.`);
      }

      // Use custom message if provided by user/customer, else fallback to clean enterprise OTP format
      const formattedContent = message?.trim() || 
`:-> *${brandName} Verification Code*

Your verification code is: *${code}*

:-> This code is valid for 5 minutes.
:-> For your security, do not share this code with anyone.

_If you did not request this verification, please disregard this message._`;

      const messageDoc = new WhatsAppMessage({
        userId,
        sessionId,
        to: cleanNumber,
        type: 'otp',
        content: formattedContent,
        otpCode: code,
        status: 'queued',
      });
      await messageDoc.save();

      try {
        // Fast typing simulation for time-sensitive OTPs
        const typingDuration = this.computeTypingDuration(formattedContent, true);
        try {
          await sock.presenceSubscribe(jid);
          await sock.sendPresenceUpdate('composing', jid);
          await new Promise((res) => setTimeout(res, typingDuration));
          await sock.sendPresenceUpdate('paused', jid);
        } catch {
          // Ignore presence error
        }

        const sentResult = await sock.sendMessage(jid, { text: formattedContent });

        if (!sentResult?.key?.id) {
          throw new Error('OTP dispatch failed: No message ID returned.');
        }

        messageDoc.messageId = sentResult.key.id;
        messageDoc.status = 'sent';
        messageDoc.sentAt = new Date();
        await messageDoc.save();

        webhookService.dispatchEvent(userId, 'message.sent', {
          messageId: messageDoc.messageId,
          to: messageDoc.to,
          type: messageDoc.type,
          sentAt: messageDoc.sentAt,
        });

        // Short cooldown for OTPs
        const cooldown = this.getPacingDelay(true);
        await new Promise((res) => setTimeout(res, cooldown));

        return messageDoc;
      } catch (error: any) {
        messageDoc.status = 'failed';
        messageDoc.error = error.message || 'OTP dispatch error';
        await messageDoc.save();

        webhookService.dispatchEvent(userId, 'message.failed', {
          to: cleanNumber,
          error: messageDoc.error,
          type: messageDoc.type,
        });

        throw new Error(`Failed to send WhatsApp OTP: ${error.message}`);
      }
    });
  }

  /**
   * Query delivery logs with filtering and pagination
   */
  async getMessageLogs(userId: string, query: { page?: number; limit?: number; status?: string; to?: string }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { userId };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.to) {
      filter.to = new RegExp(query.to.replace(/\D/g, ''), 'i');
    }

    const [logs, total] = await Promise.all([
      WhatsAppMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      WhatsAppMessage.countDocuments(filter),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Compute message delivery statistics for customer analytics
   */
  async getMessageStats(userId: string) {
    const filter = { userId };
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, sent, delivered, failed, last24h] = await Promise.all([
      WhatsAppMessage.countDocuments(filter),
      WhatsAppMessage.countDocuments({ ...filter, status: 'sent' }),
      WhatsAppMessage.countDocuments({ ...filter, status: 'delivered' }),
      WhatsAppMessage.countDocuments({ ...filter, status: 'failed' }),
      WhatsAppMessage.countDocuments({ ...filter, createdAt: { $gte: oneDayAgo } }),
    ]);

    const successful = sent + delivered;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 100;

    return {
      total,
      sent,
      delivered,
      successful,
      failed,
      last24h,
      successRate,
    };
  }

  /**
   * Get single message by ID
   */
  async getMessageById(userId: string, messageDocId: string): Promise<IWhatsAppMessageDocument | null> {
    return WhatsAppMessage.findOne({ _id: messageDocId, userId });
  }

  /**
   * Check if a phone number is registered on WhatsApp using Baileys onWhatsApp lookup
   */
  async lookupPhoneNumber(userId: string, phone: string, sessionId: string = 'primary'): Promise<{
    registered: boolean;
    jid?: string;
    formattedPhone: string;
  }> {
    const { cleanNumber, jid } = this.normalizePhoneNumber(phone);
    const sock = whatsappSessionService.getSocket(userId, sessionId);
    if (!sock) {
      throw new Error(`WhatsApp session '${sessionId}' is not connected. Please connect WhatsApp first.`);
    }

    try {
      const results = await sock.onWhatsApp(jid);
      const target = results && results.length > 0 ? results[0] : null;

      return {
        registered: !!(target && target.exists),
        jid: target?.jid || jid,
        formattedPhone: `+${cleanNumber}`,
      };
    } catch (err: any) {
      throw new Error(`WhatsApp lookup failed: ${err.message || 'Unknown network error'}`);
    }
  }

  /**
   * Export message logs as an RFC-compliant CSV string
   */
  async exportMessageLogsCsv(userId: string, query: { status?: string; to?: string }): Promise<string> {
    const filter: any = { userId };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.to) {
      filter.to = new RegExp(query.to.replace(/\D/g, ''), 'i');
    }

    const messages = await WhatsAppMessage.find(filter).sort({ createdAt: -1 }).limit(1000);

    const headers = ['Message ID', 'Recipient', 'Type', 'Status', 'Sent At', 'Error', 'Content'];
    const rows = messages.map((m) => {
      const id = m.messageId || m._id.toString();
      const recipient = m.to || '';
      const type = m.type || 'text';
      const status = m.status || 'unknown';
      const sentAt = m.sentAt ? m.sentAt.toISOString() : (m.createdAt ? m.createdAt.toISOString() : '');
      const error = (m.error || '').replace(/"/g, '""');
      const content = (m.content || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');

      return `"${id}","${recipient}","${type}","${status}","${sentAt}","${error}","${content}"`;
    });

    return [headers.join(','), ...rows].join('\r\n');
  }
}

export const whatsappMessageService = new WhatsAppMessageService();
