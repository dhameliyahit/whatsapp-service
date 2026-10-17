import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WhatsAppService, ApiKeyRecord, WebhookConfig } from '../../../../core/services/whatsapp.service';
import { ToastService } from '../../../../core/services/toast.service';
import { environment } from '../../../../../environments/environment';

export type CodeTab = 'curl' | 'node' | 'python' | 'php' | 'java' | 'go' | 'verify';

export interface CaseStudy {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  summary: string;
  problemSolved: string;
  steps: { step: string; detail: string }[];
  payloadPreview: string;
}

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './api-keys.component.html'
})
export class ApiKeysComponent implements OnInit {
  readonly whatsAppService = inject(WhatsAppService);
  readonly toastService = inject(ToastService);

  readonly apiKeys = signal<ApiKeyRecord[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isCreating = signal<boolean>(false);

  // New Key Modal / Dialog State
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly newKeyName = signal<string>('Production Server');
  readonly generatedKey = signal<string | null>(null);

  // Webhook State
  readonly webhookUrl = signal<string>('');
  readonly webhookSecret = signal<string>('');
  readonly isSecretVisible = signal<boolean>(false);
  readonly webhookIsActive = signal<boolean>(true);
  readonly selectedEvents = signal<string[]>(['otp.verified', 'message.sent', 'message.delivered', 'message.failed']);
  readonly lastDeliveryStatus = signal<number | null>(null);
  readonly lastDeliveryAt = signal<string | null>(null);
  readonly isSavingWebhook = signal<boolean>(false);
  readonly isTestingWebhook = signal<boolean>(false);
  readonly isRotatingSecret = signal<boolean>(false);

  // Selected Code Snippet Tab
  readonly activeCodeTab = signal<CodeTab>('curl');

  // Case Studies State
  readonly activeCaseStudyId = signal<string>('ecommerce');

  readonly caseStudies: CaseStudy[] = [
    {
      id: 'ecommerce',
      title: 'E-Commerce Cash-on-Delivery (COD) & Checkout Verification',
      badge: 'Retail & E-Commerce',
      badgeColor: 'emerald',
      summary: 'Prevent fake orders, bogus delivery addresses, and return-to-origin (RTO) shipping losses by validating recipient phone identity before warehouse packing.',
      problemSolved: 'Fake COD orders cause 20-30% return rates in emerging markets. WhatsApp OTP achieves 98%+ open rates in under 15 seconds.',
      steps: [
        { step: '1. Cart Checkout', detail: 'User clicks "Place Order (Cash on Delivery)" with phone +91 98765 43210.' },
        { step: '2. Dispatch OTP', detail: 'Merchant backend calls POST /api/otp/send with codeLength: 6, expiryMinutes: 5.' },
        { step: '3. Customer Reads Code', detail: 'Customer receives branded WhatsApp message with official logo within 1.5 seconds.' },
        { step: '4. Verify & Confirm', detail: 'User submits 6-digit code. Merchant backend calls POST /api/otp/verify. Order is confirmed.' }
      ],
      payloadPreview: `{
  "to": "919876543210",
  "brandName": "NordicStore",
  "codeLength": 6,
  "expiryMinutes": 5,
  "metadata": { "orderId": "ORD-94812", "amount": 149.00 }
}`
    },
    {
      id: 'saas',
      title: 'SaaS Two-Factor Authentication (2FA) & High-Risk Approvals',
      badge: 'Security & SaaS',
      badgeColor: 'blue',
      summary: 'Protect sensitive user accounts, password resets, and critical actions (API key creation, payout bank account modifications) without legacy telecom SMS delays.',
      problemSolved: 'SMS OTPs frequently fail due to DND registry rules and roaming network dropouts. WhatsApp socket delivery bypasses SMS gateways entirely.',
      steps: [
        { step: '1. Login Request', detail: 'User inputs email and password on your dashboard login form.' },
        { step: '2. 2FA Trigger', detail: 'System generates verification challenge via POST /api/otp/send.' },
        { step: '3. Single-Use Auth', detail: 'User inputs OTP. System calls POST /api/otp/verify with attempt guard (max 3 tries).' },
        { step: '4. Issue JWT', detail: 'Session granted. If expired or brute-forced, access is immediately locked.' }
      ],
      payloadPreview: `{
  "to": "15550192834",
  "brandName": "CloudMetrics 2FA",
  "codeLength": 6,
  "expiryMinutes": 3,
  "metadata": { "userId": "usr_8812a", "action": "payout_update" }
}`
    },
    {
      id: 'fintech',
      title: 'Fintech Transaction Alerts & Webhook Receipts',
      badge: 'Fintech & Banking',
      badgeColor: 'slate',
      summary: 'Trigger instant one-time authorization for fund transfers and listen for cryptographic HMAC-SHA256 webhook callbacks to satisfy regulatory compliance.',
      problemSolved: 'Financial audit trails require immutable proof of delivery and verification timestamps with HMAC signature verification.',
      steps: [
        { step: '1. Transfer Request', detail: 'User requests withdrawal of funds to external account.' },
        { step: '2. High-Priority Dispatch', detail: 'Backend dispatches verification code to verified user number.' },
        { step: '3. Customer Approves', detail: 'Customer submits code; backend confirms via POST /api/otp/verify.' },
        { step: '4. Webhook Event', detail: 'Verifinder dispatches signed otp.verified event with signature to merchant URL.' }
      ],
      payloadPreview: `{
  "to": "447911123456",
  "brandName": "FinPay Safe",
  "codeLength": 6,
  "expiryMinutes": 2,
  "metadata": { "transferId": "TX-9901", "currency": "GBP" }
}`
    }
  ];

  // Dynamic API Base URL from environment & backend configuration
  readonly configuredApiUrl = signal<string>(environment.apiUrl);

  get apiUrl(): string {
    return this.configuredApiUrl() || environment.apiUrl;
  }

  get activeCaseStudy(): CaseStudy {
    return this.caseStudies.find(c => c.id === this.activeCaseStudyId()) || this.caseStudies[0];
  }

  ngOnInit(): void {
    this.loadConfig();
    this.loadKeys();
    this.loadWebhook();
  }

  async loadConfig(): Promise<void> {
    try {
      const config = await this.whatsAppService.getPublicConfig();
      if (config?.apiUrl) {
        this.configuredApiUrl.set(config.apiUrl);
      }
    } catch {
      // Gracefully retains dynamic environment.apiUrl
    }
  }

  async loadKeys(): Promise<void> {
    this.isLoading.set(true);
    try {
      const keys = await this.whatsAppService.getApiKeys();
      this.apiKeys.set(keys);
    } catch {
      this.toastService.error('Error', 'Could not load API keys.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadWebhook(): Promise<void> {
    try {
      const config = await this.whatsAppService.getWebhookConfig();
      if (config) {
        this.webhookUrl.set(config.url || '');
        this.webhookSecret.set(config.secretKey || '');
        this.webhookIsActive.set(config.isActive !== false);
        this.selectedEvents.set(config.events || []);
        this.lastDeliveryStatus.set(config.lastDeliveryStatus || null);
        this.lastDeliveryAt.set(config.lastDeliveryAt || null);
      }
    } catch {
      // ignore
    }
  }

  openCreateModal(): void {
    this.newKeyName.set('Production Server');
    this.generatedKey.set(null);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.generatedKey.set(null);
  }

  async onCreateKey(): Promise<void> {
    const name = this.newKeyName().trim();
    if (!name) {
      this.toastService.warning('Name Required', 'Please enter a name for the API key.');
      return;
    }

    this.isCreating.set(true);
    try {
      const result = await this.whatsAppService.createApiKey(name);
      this.generatedKey.set(result.apiKey);
      this.toastService.success('Key Generated', 'New API key created successfully.');
      this.loadKeys();
    } catch (err: any) {
      this.toastService.error('Creation Failed', err?.error?.message || 'Could not generate API key.');
    } finally {
      this.isCreating.set(false);
    }
  }

  async onRevokeKey(id: string): Promise<void> {
    if (!confirm('Are you sure you want to revoke this API key? Any applications using it will immediately lose access.')) {
      return;
    }

    try {
      await this.whatsAppService.revokeApiKey(id);
      this.toastService.success('Key Revoked', 'API key has been revoked.');
      this.loadKeys();
    } catch {
      this.toastService.error('Revocation Failed', 'Could not revoke API key.');
    }
  }

  toggleEvent(eventName: string): void {
    const current = this.selectedEvents();
    if (current.includes(eventName)) {
      this.selectedEvents.set(current.filter((e) => e !== eventName));
    } else {
      this.selectedEvents.set([...current, eventName]);
    }
  }

  async onSaveWebhook(): Promise<void> {
    const url = this.webhookUrl().trim();
    if (!url) {
      this.toastService.warning('URL Required', 'Please provide a valid webhook URL.');
      return;
    }

    this.isSavingWebhook.set(true);
    try {
      const saved = await this.whatsAppService.saveWebhookConfig({
        url,
        events: this.selectedEvents(),
        isActive: this.webhookIsActive(),
      });
      this.webhookSecret.set(saved.secretKey);
      this.toastService.success('Webhook Saved', 'Outbound webhook destination updated.');
    } catch (err: any) {
      this.toastService.error('Save Failed', err?.error?.message || err?.message || 'Failed to save webhook.');
    } finally {
      this.isSavingWebhook.set(false);
    }
  }

  async onTestWebhook(): Promise<void> {
    this.isTestingWebhook.set(true);
    try {
      const res = await this.whatsAppService.testWebhook();
      if (res.success) {
        this.lastDeliveryStatus.set(res.statusCode || 200);
        this.lastDeliveryAt.set(new Date().toISOString());
        this.toastService.success('Ping Successful', `Webhook received HTTP ${res.statusCode || 200}.`);
      } else {
        this.lastDeliveryStatus.set(res.statusCode || 0);
        this.toastService.error('Ping Failed', res.error || 'Webhook delivery failed.');
      }
    } catch (err: any) {
      this.toastService.error('Ping Error', err?.error?.message || err?.message || 'Could not dispatch ping.');
    } finally {
      this.isTestingWebhook.set(false);
    }
  }

  async onRotateSecret(): Promise<void> {
    if (!confirm('Rotate webhook secret? You will need to update your backend HMAC verification secret.')) {
      return;
    }
    this.isRotatingSecret.set(true);
    try {
      const updated = await this.whatsAppService.rotateWebhookSecret();
      this.webhookSecret.set(updated.secretKey);
      this.toastService.success('Secret Rotated', 'New HMAC signature secret generated.');
    } catch (err: any) {
      this.toastService.error('Rotation Failed', err?.error?.message || 'Could not rotate secret.');
    } finally {
      this.isRotatingSecret.set(false);
    }
  }

  async onDeleteWebhook(): Promise<void> {
    if (!confirm('Delete webhook endpoint? Notifications will no longer be dispatched.')) {
      return;
    }
    try {
      await this.whatsAppService.deleteWebhook();
      this.webhookUrl.set('');
      this.webhookSecret.set('');
      this.lastDeliveryStatus.set(null);
      this.lastDeliveryAt.set(null);
      this.toastService.success('Deleted', 'Webhook configuration removed.');
    } catch {
      this.toastService.error('Delete Failed', 'Could not delete webhook.');
    }
  }

  copyToClipboard(text: string, label: string = 'Copied to clipboard'): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.toastService.success('Copied', label);
    }
  }

  get activeKeyPrefix(): string {
    const active = this.apiKeys().find(k => k.status === 'active');
    return active ? `${active.prefix.substring(0, 11)}...` : 'vf_live_your_api_key_here';
  }

  get snippetContent(): string {
    const tab = this.activeCodeTab();
    const sendOtpUrl = `${this.apiUrl}/otp/send`;
    const verifyOtpUrl = `${this.apiUrl}/otp/verify`;
    const key = this.activeKeyPrefix;

    if (tab === 'curl') {
      return `# 1. Send OTP Verification Code
curl -X POST "${sendOtpUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${key}" \\
  -d '{
    "to": "919876543210",
    "brandName": "YourBrand",
    "codeLength": 6,
    "expiryMinutes": 5
  }'

# 2. Verify Incoming OTP Code
curl -X POST "${verifyOtpUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${key}" \\
  -d '{
    "to": "919876543210",
    "code": "482910"
  }'`;
    }

    if (tab === 'node') {
      return `// 1. Send OTP Verification Code (Node.js 18+)
const sendResponse = await fetch("${sendOtpUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${key}"
  },
  body: JSON.stringify({
    to: "919876543210",
    brandName: "YourBrand",
    codeLength: 6,
    expiryMinutes: 5
  })
});
const sendData = await sendResponse.json();
console.log("OTP Dispatched:", sendData.data.verificationId);

// 2. Verify Incoming OTP Code
const verifyResponse = await fetch("${verifyOtpUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${key}"
  },
  body: JSON.stringify({
    to: "919876543210",
    code: "482910"
  })
});
const verifyResult = await verifyResponse.json();
if (verifyResult.data?.valid) {
  console.log("Customer Verified Successfully!");
}`;
    }

    if (tab === 'python') {
      return `import requests

# 1. Send OTP Verification Code
send_payload = {
    "to": "919876543210",
    "brandName": "YourBrand",
    "codeLength": 6,
    "expiryMinutes": 5
}
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "${key}"
}
send_res = requests.post("${sendOtpUrl}", json=send_payload, headers=headers)
print("Send Response:", send_res.json())

# 2. Verify Incoming Code
verify_payload = {
    "to": "919876543210",
    "code": "482910"
}
verify_res = requests.post("${verifyOtpUrl}", json=verify_payload, headers=headers)
result = verify_res.json()
if result.get("data", {}).get("valid"):
    print("User authenticated successfully!")`;
    }

    if (tab === 'php') {
      return `<?php
// 1. Send OTP Verification Code
$ch = curl_init("${sendOtpUrl}");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode([
    "to" => "919876543210",
    "brandName" => "YourBrand",
    "codeLength" => 6,
    "expiryMinutes" => 5
  ]),
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "X-API-Key: ${key}"
  ],
]);
$response = curl_exec($ch);
curl_close($ch);
$data = json_decode($response, true);

// 2. Verify Incoming OTP Code
$verifyCh = curl_init("${verifyOtpUrl}");
curl_setopt_array($verifyCh, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode([
    "to" => "919876543210",
    "code" => "482910"
  ]),
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "X-API-Key: ${key}"
  ],
]);
$verifyResult = json_decode(curl_exec($verifyCh), true);
curl_close($verifyCh);
print_r($verifyResult);`;
    }

    if (tab === 'java') {
      return `// Java (OkHttp 4.x)
import okhttp3.*;
import java.io.IOException;

public class VerifinderClient {
    private static final OkHttpClient client = new OkHttpClient();
    private static final String API_KEY = "${key}";

    public static void sendOtp(String phone, String brand) throws IOException {
        String json = String.format("{\\"to\\":\\"%s\\",\\"brandName\\":\\"%s\\",\\"codeLength\\":6}", phone, brand);
        RequestBody body = RequestBody.create(json, MediaType.parse("application/json"));
        Request request = new Request.Builder()
            .url("${sendOtpUrl}")
            .addHeader("X-API-Key", API_KEY)
            .post(body)
            .build();

        try (Response response = client.newCall(request).execute()) {
            System.out.println("Dispatched: " + response.body().string());
        }
    }
}`;
    }

    if (tab === 'go') {
      return `// Go (net/http)
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	payload, _ := json.Marshal(map[string]interface{}{
		"to":            "919876543210",
		"brandName":     "YourBrand",
		"codeLength":    6,
		"expiryMinutes": 5,
	})

	req, _ := http.NewRequest("POST", "${sendOtpUrl}", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "${key}")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	fmt.Println("Status:", resp.Status)
}`;
    }

    return `// Outbound Webhook Verification (HMAC-SHA256)
// Node.js Express Middleware Example
const crypto = require('crypto');

function verifyVerifinderWebhook(req, secretKey) {
  const incomingSig = req.headers['x-verifinder-signature'];
  if (!incomingSig) return false;

  const rawBody = JSON.stringify(req.body);
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', secretKey)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(incomingSig),
    Buffer.from(expectedSig)
  );
}`;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'Never';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }
}
