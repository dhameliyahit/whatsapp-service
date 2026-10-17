import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WhatsAppService, MessageStats } from '../../../../core/services/whatsapp.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-overview.component.html'
})
export class DashboardOverviewComponent implements OnInit, OnDestroy {
  readonly whatsAppService = inject(WhatsAppService);
  readonly toastService = inject(ToastService);

  readonly session = this.whatsAppService.sessionState;
  readonly isConfirmingDisconnect = signal<boolean>(false);
  readonly stats = signal<MessageStats | null>(null);

  // Ping Diagnostic State
  readonly isPinging = signal<boolean>(false);
  readonly pingResult = signal<{ alive: boolean; latencyMs: number } | null>(null);

  ngOnInit(): void {
    this.loadStats();
    this.whatsAppService.fetchStatus().then((state) => {
      if (state?.status === 'connecting' || state?.status === 'qr_ready') {
        this.whatsAppService.subscribeToLiveEvents();
        this.whatsAppService.startStatusPolling();
      }
    });
  }

  async loadStats(): Promise<void> {
    const data = await this.whatsAppService.getMessageStats();
    if (data) {
      this.stats.set(data);
    }
  }

  async onPingGateway(): Promise<void> {
    this.isPinging.set(true);
    try {
      const res = await this.whatsAppService.pingGateway();
      this.pingResult.set(res);
      if (res.alive) {
        this.toastService.success('Gateway Healthy', `Active socket connection response in ${res.latencyMs}ms.`);
      } else {
        this.toastService.warning('Gateway Unreachable', 'WhatsApp socket is currently disconnected.');
      }
    } finally {
      this.isPinging.set(false);
    }
  }

  ngOnDestroy(): void {
    this.whatsAppService.stopStatusPolling();
  }

  async onConnectWhatsApp(): Promise<void> {
    try {
      this.toastService.info('Connecting', 'Initializing WhatsApp Multi-Device session...');
      const session = await this.whatsAppService.connectSession();
      if (session?.qrCode) {
        this.toastService.success('QR Code Ready', 'Please scan the QR code with WhatsApp on your phone.');
      }
    } catch (err: any) {
      this.toastService.error('Connection Error', err?.error?.message || err?.message || 'Failed to start session.');
    }
  }

  startDisconnectConfirmation(): void {
    this.isConfirmingDisconnect.set(true);
  }

  cancelDisconnectConfirmation(): void {
    this.isConfirmingDisconnect.set(false);
  }

  async onConfirmDisconnect(): Promise<void> {
    this.isConfirmingDisconnect.set(false);
    await this.onDisconnectWhatsApp();
  }

  async onDisconnectWhatsApp(): Promise<void> {
    try {
      const ok = await this.whatsAppService.disconnectSession();
      if (ok) {
        this.toastService.info('Disconnected', 'WhatsApp session has been safely logged out.');
      }
    } catch (err: any) {
      this.toastService.error('Disconnect Failed', err?.message || 'Could not terminate session.');
    }
  }
}
