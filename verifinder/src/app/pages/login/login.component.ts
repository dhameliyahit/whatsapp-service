import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly returnUrl = signal<string>('/dashboard');
  readonly legalModal = signal<'tos' | 'privacy' | null>(null);

  openTos(): void {
    this.legalModal.set('tos');
  }

  openPrivacy(): void {
    this.legalModal.set('privacy');
  }

  closeLegal(): void {
    this.legalModal.set(null);
  }

  ngOnInit(): void {
    const returnUrlParam = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrlParam) {
      this.returnUrl.set(returnUrlParam);
    }

    // Initialize Google Identity Services with backend authentication callback
    this.authService.initializeGoogleSignIn((credential: string) => {
      this.onGoogleCredentialReceived(credential);
    });
  }

  onGoogleClick(): void {
    if (!this.authService.isGoogleLoaded()) {
      this.toastService.info('Connecting', 'Initializing Google Identity Services...');
    }

    this.authService.initializeGoogleSignIn((credential: string) => {
      this.onGoogleCredentialReceived(credential);
    });
    this.authService.promptGoogleSignIn();
  }

  private async onGoogleCredentialReceived(credential: string): Promise<void> {
    const success = await this.authService.loginWithGoogleBackend(credential, this.returnUrl());
    if (success) {
      const user = this.authService.currentUser();
      this.toastService.success(
        'Authentication Successful',
        `Welcome back, ${user?.name || 'User'}!`
      );
    } else {
      this.toastService.error(
        'Authentication Failed',
        this.authService.authError() || 'Could not verify token with backend.'
      );
    }
  }
}
