import { Response, NextFunction } from 'express';
import { webhookService } from '../services/webhook.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.util';

export class WebhookController {
  /**
   * GET /api/webhooks
   */
  async getWebhook(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const config = await webhookService.getWebhookConfig(userId);
      sendSuccess(res, { webhook: config }, 'Webhook configuration retrieved.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/webhooks
   */
  async saveWebhook(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { url, events, isActive } = req.body;

      if (!url) {
        sendError(res, 'Webhook target URL is required.', 400);
        return;
      }

      const config = await webhookService.saveWebhookConfig(userId, { url, events, isActive });
      sendSuccess(res, { webhook: config }, 'Webhook endpoint configured successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/webhooks/rotate-secret
   */
  async rotateSecret(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const config = await webhookService.rotateSecretKey(userId);
      sendSuccess(res, { webhook: config }, 'Webhook secret key rotated.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/webhooks/test
   */
  async testWebhook(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await webhookService.sendTestPing(userId);

      if (!result.success) {
        sendError(res, result.error || 'Webhook test delivery failed.', 400, {
          statusCode: result.statusCode,
        });
        return;
      }

      sendSuccess(res, result, 'Test ping dispatched and verified successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/webhooks
   */
  async deleteWebhook(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await webhookService.deleteWebhook(userId);
      sendSuccess(res, null, 'Webhook configuration removed.');
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
