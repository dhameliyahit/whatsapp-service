import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WhatsAppService, WhatsAppMessageLog } from '../../../../core/services/whatsapp.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-message-logs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './message-logs.component.html'
})
export class MessageLogsComponent implements OnInit {
  readonly whatsAppService = inject(WhatsAppService);
  readonly toastService = inject(ToastService);

  readonly logs = signal<WhatsAppMessageLog[]>([]);
  readonly total = signal<number>(0);
  readonly page = signal<number>(1);
  readonly totalPages = signal<number>(1);
  readonly limit = signal<number>(15);

  readonly currentFilter = signal<'all' | 'delivered' | 'failed'>('all');
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly isExporting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadLogs();
  }

  async onExportCsv(): Promise<void> {
    this.isExporting.set(true);
    try {
      this.whatsAppService.exportLogsCsv(this.currentFilter(), this.searchQuery().trim()).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `verifinder-logs-${Date.now()}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.toastService.success('Export Ready', 'Message logs downloaded as CSV.');
          this.isExporting.set(false);
        },
        error: () => {
          this.toastService.error('Export Error', 'Could not export logs.');
          this.isExporting.set(false);
        }
      });
    } catch {
      this.toastService.error('Export Error', 'Could not export logs.');
      this.isExporting.set(false);
    }
  }

  async loadLogs(targetPage?: number): Promise<void> {
    const pageNum = targetPage ?? this.page();
    this.isLoading.set(true);

    try {
      const res = await this.whatsAppService.getLogs(
        pageNum,
        this.limit(),
        this.currentFilter(),
        this.searchQuery().trim()
      );

      this.logs.set(res.logs);
      this.total.set(res.total);
      this.page.set(res.page);
      this.totalPages.set(res.totalPages || 1);
    } catch (err: any) {
      this.toastService.error('Failed to load logs', err?.message || 'Could not fetch message logs.');
    } finally {
      this.isLoading.set(false);
    }
  }

  setFilter(filter: 'all' | 'delivered' | 'failed'): void {
    this.currentFilter.set(filter);
    this.page.set(1);
    this.loadLogs(1);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.page.set(1);
    this.loadLogs(1);
  }

  previousPage(): void {
    if (this.page() > 1) {
      this.loadLogs(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.loadLogs(this.page() + 1);
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  }
}
