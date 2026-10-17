import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

export type DashboardTab = 'dashboard' | 'otp' | 'logs' | 'api-keys';

export interface NavItem {
  id: DashboardTab;
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatTooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  readonly activeTab = input<DashboardTab>('dashboard');
  readonly isCollapsed = input<boolean>(false);
  readonly tabChange = output<DashboardTab>();
  readonly toggleCollapse = output<void>();

  readonly navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'WhatsApp Gateway',
      icon: 'whatsapp',
      route: '/dashboard'
    },
    {
      id: 'otp',
      label: 'Send OTP',
      icon: 'send',
      route: '/dashboard/send-otp'
    },
    {
      id: 'logs',
      label: 'Message Logs',
      icon: 'logs',
      route: '/dashboard/logs'
    },
    {
      id: 'api-keys',
      label: 'API & Webhooks',
      icon: 'code',
      route: '/dashboard/api-keys'
    }
  ];

  selectTab(tab: DashboardTab): void {
    this.tabChange.emit(tab);
  }
}
