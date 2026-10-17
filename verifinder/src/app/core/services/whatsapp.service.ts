import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/user.model';

export interface WhatsAppSessionState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  sessionId: string;
  phoneNumber?: string;
  name?: string;
  qrCode?: string;
  connectedAt?: string;
}

export interface WhatsAppMessageLog {
  _id: string;
  to: string;
  type: 'text' | 'otp' | 'template';
  content: string;
  otpCode?: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  messageId?: string;
  error?: string;
  sentAt?: string;
  createdAt: string;
}

export interface MessageStats {
  total: number;
  sent: number;
  delivered: number;
  successful: number;
  failed: number;
  last24h: number;
  successRate: number;
}

export interface ApiKeyRecord {
  _id: string;
  name: string;
  prefix: string;
  status: 'active' | 'revoked';
  lastUsedAt?: string;
  createdAt: string;
}

export interface OtpSendResult {
  verificationId: string;
  phoneNumber: string;
  status: string;
  expiresAt: string;
  messageDocId: string;
}

export interface OtpVerifyResult {
  valid: boolean;
  status: string;
  message: string;
  verificationId?: string;
  phoneNumber?: string;
  verifiedAt?: string;
  attemptsRemaining?: number;
}

export interface WebhookConfig {
  _id?: string;
  url: string;
  secretKey: string;
  events: string[];
  isActive: boolean;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: number;
  lastDeliveryError?: string;
}

export interface MessageTemplateItem {
  _id: string;
  name: string;
  category: 'otp' | 'notification' | 'security' | 'custom';
  body: string;
  variables: string[];
  isPreset: boolean;
}

export interface NumberLookupResult {
  registered: boolean;
  jid?: string;
  formattedPhone: string;
}

@Injectable({
  providedIn: 'root'
})
export class WhatsAppService {
  private readonly http = inject(HttpClient);

  readonly sessionState = signal<WhatsAppSessionState>({
    status: 'disconnected',
    sessionId: 'primary'
  });
  readonly isActionLoading = signal<boolean>(false);
  private eventSource: EventSource | null = null;

  /**
   * Fetch current session status from backend
   */
  async fetchStatus(): Promise<WhatsAppSessionState | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<{ session: WhatsAppSessionState }>>(`${environment.apiUrl}/whatsapp/session/status`)
      );
      if (response?.data?.session) {
        this.sessionState.set(response.data.session);
        return response.data.session;
      }
      return null;
    } catch (err: any) {
      console.warn(':-> [WhatsAppService] Error fetching status:', err?.message);
      return null;
    }
  }

  private pollingTimer: any = null;

  /**
   * Start polling fallback for environments where SSE may experience latency
   */
  startStatusPolling(): void {
    this.stopStatusPolling();
    this.pollingTimer = setInterval(async () => {
      const state = await this.fetchStatus();
      if (state?.status === 'connected' || state?.status === 'disconnected') {
        this.stopStatusPolling();
      }
    }, 2500);
  }

  stopStatusPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Start connection / request fresh QR code
   */
  async connectSession(): Promise<WhatsAppSessionState | null> {
    this.isActionLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<{ session: WhatsAppSessionState }>>(`${environment.apiUrl}/whatsapp/session/connect`, {
          sessionId: 'primary'
        })
      );
      if (response?.data?.session) {
        this.sessionState.set(response.data.session);
        this.subscribeToLiveEvents();
        if (response.data.session.status !== 'connected') {
          this.startStatusPolling();
        }
        return response.data.session;
      }
      return null;
    } finally {
      this.isActionLoading.set(false);
    }
  }

  /**
   * Disconnect WhatsApp session
   */
  async disconnectSession(): Promise<boolean> {
    this.isActionLoading.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/whatsapp/session/disconnect`, { sessionId: 'primary' })
      );
      this.sessionState.set({
        status: 'disconnected',
        sessionId: 'primary',
        phoneNumber: '',
        qrCode: ''
      });
      this.closeEventStream();
      this.stopStatusPolling();
      return true;
    } finally {
      this.isActionLoading.set(false);
    }
  }

  /**
   * Subscribe to real-time Server-Sent Events (SSE) for instant QR and status updates
   */
  subscribeToLiveEvents(): void {
    if (typeof EventSource === 'undefined') return;
    this.closeEventStream();

    const token = localStorage.getItem('verifinder_access_token');
    const sseUrl = `${environment.apiUrl}/whatsapp/session/events?sessionId=primary${token ? '&token=' + encodeURIComponent(token) : ''}`;

    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) {
          this.sessionState.update(prev => ({
            ...prev,
            status: data.status,
            qrCode: data.qrCode !== undefined ? data.qrCode : prev.qrCode,
            phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber : prev.phoneNumber,
            name: data.name !== undefined ? data.name : prev.name,
          }));

          // If connected, QR is no longer needed
          if (data.status === 'connected') {
            this.sessionState.update(prev => ({ ...prev, qrCode: '' }));
            this.stopStatusPolling();
          }
        }
      } catch (err) {
        console.error(':-> [WhatsAppService] Error parsing SSE message:', err);
      }
    };

    this.eventSource.onerror = () => {
      // Reconnect handled automatically by EventSource
    };
  }

  closeEventStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.stopStatusPolling();
  }

  /**
   * Send text message via backend
   */
  async sendMessage(to: string, message: string): Promise<any> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<{ message: WhatsAppMessageLog }>>(`${environment.apiUrl}/whatsapp/messages/send`, {
        to,
        message,
        sessionId: 'primary'
      })
    );
    return response?.data?.message;
  }

  /**
   * Send verification OTP via backend with optional custom message text
   */
  async sendOtp(to: string, code: string, brandName: string = 'Verifinder', message?: string): Promise<any> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<{ message: WhatsAppMessageLog }>>(`${environment.apiUrl}/whatsapp/messages/send-otp`, {
        to,
        code,
        brandName,
        message,
        sessionId: 'primary'
      })
    );
    return response?.data?.message;
  }

  /**
   * Fetch paginated message delivery logs with search and filter
   */
  async getLogs(page: number = 1, limit: number = 20, status?: string, to?: string): Promise<{ logs: WhatsAppMessageLog[]; total: number; page: number; totalPages: number }> {
    let url = `${environment.apiUrl}/whatsapp/messages/logs?page=${page}&limit=${limit}`;
    if (status && status !== 'all') url += `&status=${status}`;
    if (to) url += `&to=${encodeURIComponent(to)}`;

    const response = await firstValueFrom(
      this.http.get<ApiResponse<{ logs: WhatsAppMessageLog[]; total: number; page: number; totalPages: number }>>(url)
    );
    return response?.data || { logs: [], total: 0, page: 1, totalPages: 1 };
  }

  /**
   * Fetch aggregate message statistics for dashboard
   */
  async getMessageStats(): Promise<MessageStats | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<MessageStats>>(`${environment.apiUrl}/whatsapp/messages/stats`)
      );
      return response?.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Diagnostic socket ping
   */
  async pingGateway(): Promise<{ alive: boolean; latencyMs: number; phoneNumber?: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<{ alive: boolean; latencyMs: number; phoneNumber?: string }>>(
          `${environment.apiUrl}/whatsapp/session/ping`,
          { sessionId: 'primary' }
        )
      );
      return response?.data || { alive: false, latencyMs: 0 };
    } catch {
      return { alive: false, latencyMs: 0 };
    }
  }

  /**
   * Developer API Keys: List active keys
   */
  async getApiKeys(): Promise<ApiKeyRecord[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<{ keys: ApiKeyRecord[] }>>(`${environment.apiUrl}/api-keys`)
      );
      return response?.data?.keys || [];
    } catch {
      return [];
    }
  }

  /**
   * Developer API Keys: Generate new key
   */
  async createApiKey(name: string): Promise<{ apiKey: string; keyRecord: ApiKeyRecord }> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<{ apiKey: string; keyRecord: ApiKeyRecord }>>(`${environment.apiUrl}/api-keys`, { name })
    );
    if (!response?.data) {
      throw new Error(response?.message || 'Failed to create API key');
    }
    return response.data;
  }

  /**
   * Developer API Keys: Revoke key
   */
  async revokeApiKey(id: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.delete<ApiResponse<null>>(`${environment.apiUrl}/api-keys/${id}`)
    );
    return !!response?.success;
  }

  /**
   * Retrieve server public config (e.g., dynamically configured API_URL from .env)
   */
  async getPublicConfig(): Promise<{ apiUrl: string }> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<{ apiUrl: string }>>(`${environment.apiUrl}/public-config`)
      );
      if (response?.data?.apiUrl) {
        return response.data;
      }
    } catch {
      // Fallback cleanly to client-side environment.apiUrl
    }
    return { apiUrl: environment.apiUrl };
  }

  /**
   * Check if a phone number is registered on WhatsApp
   */
  async lookupNumber(phone: string): Promise<NumberLookupResult> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<NumberLookupResult>>(`${environment.apiUrl}/whatsapp/lookup`, { phone })
    );
    if (!response?.data) {
      throw new Error(response?.message || 'Lookup failed.');
    }
    return response.data;
  }

  /**
   * End-to-End OTP Engine: Send verification code with server-side hashing & TTL
   */
  async sendOtpVerification(options: {
    to: string;
    brandName?: string;
    codeLength?: number;
    expiryMinutes?: number;
    templateText?: string;
  }): Promise<OtpSendResult> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<OtpSendResult>>(`${environment.apiUrl}/otp/send`, options)
    );
    if (!response?.data) {
      throw new Error(response?.message || 'Failed to dispatch verification code.');
    }
    return response.data;
  }

  /**
   * End-to-End OTP Engine: Verify OTP code against stored hash
   */
  async verifyOtpCode(options: {
    to?: string;
    verificationId?: string;
    code: string;
  }): Promise<OtpVerifyResult> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<OtpVerifyResult>>(`${environment.apiUrl}/otp/verify`, options)
    );
    if (!response?.data) {
      throw new Error(response?.message || 'Verification check failed.');
    }
    return response.data;
  }

  /**
   * Webhooks: Get current config
   */
  async getWebhookConfig(): Promise<WebhookConfig | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<{ webhook: WebhookConfig | null }>>(`${environment.apiUrl}/webhooks`)
      );
      return response?.data?.webhook || null;
    } catch {
      return null;
    }
  }

  /**
   * Webhooks: Save configuration
   */
  async saveWebhookConfig(data: { url: string; events?: string[]; isActive?: boolean }): Promise<WebhookConfig> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<{ webhook: WebhookConfig }>>(`${environment.apiUrl}/webhooks`, data)
    );
    if (!response?.data?.webhook) {
      throw new Error(response?.message || 'Failed to save webhook configuration.');
    }
    return response.data.webhook;
  }

  /**
   * Webhooks: Rotate secret key
   */
  async rotateWebhookSecret(): Promise<WebhookConfig> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<{ webhook: WebhookConfig }>>(`${environment.apiUrl}/webhooks/rotate-secret`, {})
    );
    if (!response?.data?.webhook) {
      throw new Error(response?.message || 'Failed to rotate secret key.');
    }
    return response.data.webhook;
  }

  /**
   * Webhooks: Send test ping
   */
  async testWebhook(): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<{ success: boolean; statusCode?: number; error?: string }>>(
        `${environment.apiUrl}/webhooks/test`,
        {}
      )
    );
    if (!response?.data) {
      throw new Error(response?.message || 'Test dispatch failed.');
    }
    return response.data;
  }

  /**
   * Webhooks: Delete webhook
   */
  async deleteWebhook(): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.delete<ApiResponse<null>>(`${environment.apiUrl}/webhooks`)
    );
    return !!response?.success;
  }

  /**
   * Templates: Get all available templates
   */
  async getTemplates(): Promise<MessageTemplateItem[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<{ templates: MessageTemplateItem[] }>>(`${environment.apiUrl}/templates`)
      );
      return response?.data?.templates || [];
    } catch {
      return [];
    }
  }

  /**
   * Templates: Create new template
   */
  async createTemplate(data: { name: string; body: string; category?: string }): Promise<MessageTemplateItem> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<{ template: MessageTemplateItem }>>(`${environment.apiUrl}/templates`, data)
    );
    if (!response?.data?.template) {
      throw new Error(response?.message || 'Failed to create template.');
    }
    return response.data.template;
  }

  /**
   * Templates: Delete template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.delete<ApiResponse<null>>(`${environment.apiUrl}/templates/${id}`)
    );
    return !!response?.success;
  }

  /**
   * Message Logs: Download CSV
   */
  exportLogsCsv(status?: string, to?: string): Observable<Blob> {
    let url = `${environment.apiUrl}/whatsapp/messages/export?`;
    if (status && status !== 'all') url += `status=${encodeURIComponent(status)}&`;
    if (to) url += `to=${encodeURIComponent(to)}&`;

    return this.http.get(url, { responseType: 'blob' });
  }
}

