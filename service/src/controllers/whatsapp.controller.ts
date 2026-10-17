import { Response, NextFunction } from 'express';
import { whatsappSessionService } from '../services/whatsappSession.service';
import { whatsappMessageService } from '../services/whatsappMessage.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.util';

export class WhatsAppController {
  /**
   * POST /api/whatsapp/session/connect
   * Initialize WhatsApp connection or generate fresh QR
   */
  async connectSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessionId = (req.body.sessionId as string) || 'primary';

      const sessionDoc = await whatsappSessionService.initSession(userId, sessionId);
      sendSuccess(res, { session: sessionDoc }, 'WhatsApp connection initiated.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/whatsapp/session/status
   * Get current connection status and active phone number
   */
  async getSessionStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessionId = (req.query.sessionId as string) || 'primary';

      const sessionDoc = await whatsappSessionService.getSessionStatus(userId, sessionId);
      sendSuccess(
        res,
        {
          session: sessionDoc || {
            status: 'disconnected',
            sessionId,
            phoneNumber: '',
          },
        },
        'WhatsApp session status retrieved.'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/whatsapp/session/events (Server-Sent Events)
   * Real-time stream for QR code and connection status changes
   */
  streamSessionEvents(req: AuthenticatedRequest, res: Response): void {
    const userId = req.user!.userId;
    const sessionId = (req.query.sessionId as string) || 'primary';
    const sessionKey = `${userId}_${sessionId}`;

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const listener = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    whatsappSessionService.on(`session:${sessionKey}`, listener);

    // Initial status ping immediately upon SSE connection
    whatsappSessionService.getSessionStatus(userId, sessionId).then((doc) => {
      if (doc) {
        res.write(
          `data: ${JSON.stringify({
            status: doc.status,
            qrCode: doc.qrCode,
            phoneNumber: doc.phoneNumber,
            name: doc.name,
          })}\n\n`
        );
      }
    });

    // 15-second keep-alive heartbeat comment to prevent proxy timeouts
    const heartbeat = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      whatsappSessionService.off(`session:${sessionKey}`, listener);
      res.end();
    });
  }

  /**
   * POST /api/whatsapp/session/disconnect
   * Disconnect and clear credentials
   */
  async disconnectSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessionId = (req.body.sessionId as string) || 'primary';

      await whatsappSessionService.disconnectSession(userId, sessionId);
      sendSuccess(res, null, 'WhatsApp session disconnected successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/whatsapp/messages/send
   * Send text message
   */
  async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { to, message, sessionId = 'primary' } = req.body;

      if (!to || !message) {
        sendError(res, 'Both destination phone number (to) and message text are required.', 400);
        return;
      }

      const messageDoc = await whatsappMessageService.sendMessage({
        userId,
        to,
        content: message,
        sessionId,
      });

      sendSuccess(res, { message: messageDoc }, 'WhatsApp message dispatched successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/whatsapp/messages/send-otp
   * Send branded verification OTP code
   */
  async sendOtp(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { to, code, brandName, message, sessionId = 'primary' } = req.body;

      if (!to || !code) {
        sendError(res, 'Both destination phone number (to) and OTP code are required.', 400);
        return;
      }

      const messageDoc = await whatsappMessageService.sendOtp({
        userId,
        to,
        code,
        brandName,
        message,
        sessionId,
      });

      sendSuccess(res, { message: messageDoc }, 'Verification OTP sent via WhatsApp.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/whatsapp/messages/logs
   * Retrieve message logs
   */
  async getMessageLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string;
      const to = req.query.to as string;

      const result = await whatsappMessageService.getMessageLogs(userId, {
        page,
        limit,
        status,
        to,
      });

      sendSuccess(res, result, 'Message logs retrieved.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/whatsapp/messages/:id
   * Get single message status
   */
  async getMessageById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const messageId = req.params.id;

      const messageDoc = await whatsappMessageService.getMessageById(userId, messageId);
      if (!messageDoc) {
        sendError(res, 'Message log not found.', 404);
        return;
      }

      sendSuccess(res, { message: messageDoc }, 'Message details retrieved.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/whatsapp/messages/stats
   * Retrieve aggregate metrics for customer dashboard
   */
  async getMessageStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const stats = await whatsappMessageService.getMessageStats(userId);
      sendSuccess(res, stats, 'Message statistics retrieved.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/whatsapp/session/ping
   * Check live socket connection and latency
   */
  async pingSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { sessionId = 'primary' } = req.body;
      const result = await whatsappSessionService.pingSession(userId, sessionId);
      sendSuccess(res, result, result.alive ? 'Gateway ping healthy.' : 'Gateway is offline.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/whatsapp/lookup
   * Check if a destination phone number has an active WhatsApp account
   */
  async lookupNumber(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { phone, sessionId = 'primary' } = req.body;

      if (!phone) {
        sendError(res, 'Phone number is required for lookup.', 400);
        return;
      }

      const result = await whatsappMessageService.lookupPhoneNumber(userId, phone, sessionId);
      sendSuccess(res, result, result.registered ? 'Phone number is registered on WhatsApp.' : 'Phone number is not on WhatsApp.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/whatsapp/messages/export
   * Export message logs as CSV file
   */
  async exportLogsCsv(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { status, to } = req.query;

      const csvContent = await whatsappMessageService.exportMessageLogsCsv(userId, {
        status: status as string,
        to: to as string,
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="verifinder-logs-${Date.now()}.csv"`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}

export const whatsappController = new WhatsAppController();

