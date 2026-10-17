import crypto from 'crypto';
import { WebhookConfig, IWebhookConfigDocument, WebhookEvent } from '../models/webhook.model';

export class WebhookService {
  /**
   * Retrieve active webhook configuration for a user
   */
  async getWebhookConfig(userId: string): Promise<IWebhookConfigDocument | null> {
    return WebhookConfig.findOne({ userId });
  }

  /**
   * Create or update webhook configuration
   */
  async saveWebhookConfig(
    userId: string,
    data: { url: string; events?: WebhookEvent[]; isActive?: boolean }
  ): Promise<IWebhookConfigDocument> {
    const url = data.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Webhook URL must begin with http:// or https://');
    }

    let config = await WebhookConfig.findOne({ userId });
    if (!config) {
      const secretKey = `whsec_${crypto.randomBytes(24).toString('hex')}`;
      config = new WebhookConfig({
        userId,
        url,
        secretKey,
        events: data.events || ['otp.verified', 'message.sent', 'message.delivered', 'message.failed'],
        isActive: data.isActive !== undefined ? data.isActive : true,
      });
    } else {
      config.url = url;
      if (data.events) config.events = data.events;
      if (data.isActive !== undefined) config.isActive = data.isActive;
    }

    await config.save();
    return config;
  }

  /**
   * Regenerate secret key for webhook verification
   */
  async rotateSecretKey(userId: string): Promise<IWebhookConfigDocument> {
    const config = await WebhookConfig.findOne({ userId });
    if (!config) {
      throw new Error('Webhook configuration not found.');
    }

    config.secretKey = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    await config.save();
    return config;
  }

  /**
   * Delete webhook configuration
   */
  async deleteWebhook(userId: string): Promise<boolean> {
    const res = await WebhookConfig.deleteOne({ userId });
    return (res.deletedCount || 0) > 0;
  }

  /**
   * Send a test ping webhook event
   */
  async sendTestPing(userId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const config = await WebhookConfig.findOne({ userId });
    if (!config) {
      throw new Error('No webhook endpoint configured. Please set your URL first.');
    }

    const testPayload = {
      event: 'test.ping',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test notification from Verifinder WhatsApp Gateway.',
        service: 'Verifinder',
      },
    };

    return this.dispatch(config, 'test.ping', testPayload);
  }

  /**
   * Asynchronously dispatch a signed webhook notification
   */
  async dispatchEvent(userId: string, event: WebhookEvent, data: Record<string, any>): Promise<void> {
    try {
      const config = await WebhookConfig.findOne({ userId });
      if (!config || !config.isActive) return;

      // Check if user subscribed to this event
      if (!config.events.includes(event)) return;

      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      // Run dispatch in background without blocking main thread
      this.dispatch(config, event, payload).catch((err) => {
        console.error(`[Webhook] Dispatch failure for user ${userId}:`, err?.message || err);
      });
    } catch (err: any) {
      console.error(`[Webhook] Could not initiate dispatch:`, err?.message || err);
    }
  }

  /**
   * Internal HTTP POST dispatcher with HMAC-SHA256 signature
   */
  private async dispatch(
    config: IWebhookConfigDocument,
    event: string,
    payload: Record<string, any>
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', config.secretKey).update(rawBody).digest('hex');
    const deliveryId = `del_${crypto.randomUUID()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Verifinder-Webhook/1.0',
          'X-Verifinder-Event': event,
          'X-Verifinder-Delivery': deliveryId,
          'X-Verifinder-Signature': `sha256=${signature}`,
        },
        body: rawBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      config.lastDeliveryAt = new Date();
      config.lastDeliveryStatus = response.status;
      config.lastDeliveryError = response.ok ? undefined : `HTTP status ${response.status}`;
      await config.save();

      return {
        success: response.ok,
        statusCode: response.status,
        error: response.ok ? undefined : `Endpoint responded with status ${response.status}`,
      };
    } catch (err: any) {
      const errorMsg = err.name === 'AbortError' ? 'Webhook request timed out (8s)' : err.message;
      config.lastDeliveryAt = new Date();
      config.lastDeliveryStatus = 0;
      config.lastDeliveryError = errorMsg;
      await config.save();

      return {
        success: false,
        statusCode: 0,
        error: errorMsg,
      };
    }
  }
}

export const webhookService = new WebhookService();
