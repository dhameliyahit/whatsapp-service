import { Component, inject, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { WhatsAppService } from '../../../core/services/whatsapp.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
  readonly whatsAppService = inject(WhatsAppService);
  readonly toastService = inject(ToastService);
  readonly router = inject(Router);

  readonly toggleSidebar = output<void>();
  readonly navigateTab = output<string>();

  readonly user = this.authService.currentUser;
  readonly session = this.whatsAppService.sessionState;

  readonly isProfileMenuOpen = signal<boolean>(false);
  readonly avatarError = signal<boolean>(false);


  readonly userInitial = computed(() => {
    const name = this.user()?.name || this.user()?.email || 'Dharmeliya hit';
    return name.trim().charAt(0).toUpperCase() || 'D';
  });

  readonly avatarUrl = computed(() => {
    return this.user()?.picture || null;
  });

  toggleProfile(): void {
    this.isProfileMenuOpen.update(v => !v);
  }

  closeProfile(): void {
    this.isProfileMenuOpen.set(false);
  }

  onGatewayStatusClick(): void {
    this.navigateTab.emit('gateway');
    this.router.navigate(['/dashboard']);
  }

  onLogout(): void {
    this.closeProfile();
    this.toastService.info('Signed Out', 'You have been safely logged out.');
    this.authService.logout();
  }
}



