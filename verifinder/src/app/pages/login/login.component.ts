import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, AfterViewInit {
  readonly authService = inject(AuthService);
  readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly returnUrl = signal<string>('/dashboard');
  readonly legalModal = signal<'tos' | 'privacy' | null>(null);
  readonly isDev = !environment.production;
  readonly isGoogleNativeLoaded = signal<boolean>(false);

  openTos(): void {
    this.legalModal.set('tos');
  }

  openPrivacy(): void {
    this.legalModal.set('privacy');
  }

  closeLegal(): void {
    this.legalModal.set(null);
  }

  dismissError(): void {
    this.authService.authError.set(null);
  }

  ngOnInit(): void {
    const returnUrlParam = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrlParam) {
      this.returnUrl.set(returnUrlParam);
    }

    // Pre-initialize Google Identity Services
    this.authService.initializeGoogleSignIn((credential: string) => {
      this.onGoogleCredentialReceived(credential);
    });
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.renderNativeGoogleButton();
      }, 250);
    }
  }

  private renderNativeGoogleButton(): void {
    const container = document.getElementById('googleNativeBtn');
    if (container) {
      this.authService
        .renderGoogleButton(
          container,
          (credential: string) => {
            this.onGoogleCredentialReceived(credential);
          },
          {
            width: 320,
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left'
          }
        )
        .then(() => {
          if (container.children.length > 0) {
            this.isGoogleNativeLoaded.set(true);
          }
        })
        .catch(err => {
          console.warn('Native Google button render notice:', err);
        });
    }
  }

  /**
   * Main Google Sign-In click handler with instant loading state
   */
  async onGoogleClick(): Promise<void> {
    if (this.authService.isLoading()) return;

    this.authService.authError.set(null);

    const success = await this.authService.signInWithGoogle(this.returnUrl());

    if (success) {
      const user = this.authService.currentUser();
      this.toastService.success(
        'Authentication Successful',
        `Welcome back, ${user?.name || 'User'}!`
      );
    } else {
      const errorMsg = this.authService.authError();
      if (errorMsg) {
        this.toastService.error('Sign-In Notice', errorMsg);
      }
    }
  }

  /**
   * Developer login bypass for local testing
   */
  async onDevLogin(): Promise<void> {
    if (this.authService.isLoading()) return;

    this.authService.authError.set(null);
    const success = await this.authService.loginWithDevMock(this.returnUrl());

    if (success) {
      const user = this.authService.currentUser();
      this.toastService.success(
        'Developer Authentication',
        `Welcome, ${user?.name || 'Developer'}!`
      );
    } else {
      this.toastService.error(
        'Authentication Failed',
        this.authService.authError() || 'Could not connect to backend server.'
      );
    }
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
