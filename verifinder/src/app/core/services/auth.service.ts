import { Injectable, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserProfile, ApiResponse, AuthResponseData, GoogleAuthResponse } from '../models/user.model';
import { environment } from '../../../environments/environment';

declare const google: any;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly USER_KEY = 'verifinder_auth_user';
  private readonly ACCESS_TOKEN_KEY = 'verifinder_access_token';
  private readonly REFRESH_TOKEN_KEY = 'verifinder_refresh_token';

  // Signals for reactive auth state
  readonly currentUser = signal<UserProfile | null>(this.getInitialUser());
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isGoogleLoaded = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly authError = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkGoogleScriptLoaded();
      this.syncUserWithBackend();
    }
  }

  private getInitialUser(): UserProfile | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const stored = localStorage.getItem(this.USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  getAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * Validate and refresh current user profile with backend API
   */
  private async syncUserWithBackend(): Promise<void> {
    const token = this.getAccessToken();
    if (!token) return;

    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<{ user: UserProfile }>>(`${environment.apiUrl}/auth/me`)
      );

      if (response?.data?.user) {
        this.currentUser.set(response.data.user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(response.data.user));
      }
    } catch (error: any) {
      console.warn('[AuthService] Backend session sync notice:', error?.message);
      // If token is invalid or expired, clear session
      if (error?.status === 401) {
        this.clearLocalSession();
      }
    }
  }

  /**
   * Check if Google Identity Services SDK is ready
   */
  private checkGoogleScriptLoaded(): void {
    if (typeof google !== 'undefined' && google?.accounts?.id) {
      this.isGoogleLoaded.set(true);
      return;
    }

    const interval = setInterval(() => {
      if (typeof google !== 'undefined' && google?.accounts?.id) {
        this.isGoogleLoaded.set(true);
        clearInterval(interval);
      }
    }, 150);

    setTimeout(() => clearInterval(interval), 10000);
  }

  /**
   * Initializes Google Identity Services
   */
  async initializeGoogleSignIn(callback: (credential: string) => void): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    let clientId = environment.googleClientId;
    if (!clientId) {
      try {
        const res: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/auth/config`));
        if (res?.data?.googleClientId) {
          clientId = res.data.googleClientId;
          (window as any).__ENV = Object.assign((window as any).__ENV || {}, { GOOGLE_CLIENT_ID: clientId });
        }
      } catch (err) {
        console.warn('Google config lookup notice:', err);
      }
    }

    if (typeof google !== 'undefined' && google?.accounts?.id && clientId) {
      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: GoogleAuthResponse) => {
            if (response?.credential) {
              callback(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        this.isGoogleLoaded.set(true);
      } catch (err) {
        console.warn('Google Identity initialization notice:', err);
      }
    }
  }

  /**
   * Prompt Google One-Tap or sign-in popup
   */
  promptGoogleSignIn(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (typeof google !== 'undefined' && google?.accounts?.id) {
      try {
        google.accounts.id.prompt();
      } catch (err) {
        console.warn('Google prompt notice:', err);
      }
    }
  }

  /**
   * Authenticate with backend API using Google credential token
   */
  async loginWithGoogleBackend(idToken: string, redirectUrl: string = '/dashboard'): Promise<boolean> {
    this.isLoading.set(true);
    this.authError.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<AuthResponseData>>(`${environment.apiUrl}/auth/google`, { idToken })
      );

      if (!response?.success || !response.data) {
        throw new Error(response?.message || 'Authentication with backend failed.');
      }

      const { user, accessToken, refreshToken } = response.data;

      // Store credentials and session in browser
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      }

      this.currentUser.set(user);
      this.router.navigateByUrl(redirectUrl);
      return true;
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Backend authentication failed.';
      this.authError.set(msg);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Logout user via backend API and clear local tokens
   */
  async logout(): Promise<void> {
    try {
      if (this.getAccessToken()) {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/auth/logout`, {})
        ).catch(() => {});
      }
    } finally {
      this.clearLocalSession();
      this.router.navigate(['/login']);
    }
  }

  private clearLocalSession(): void {
    this.currentUser.set(null);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.ACCESS_TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        if (typeof google !== 'undefined' && google?.accounts?.id) {
          google.accounts.id.disableAutoSelect?.();
        }
      } catch (err) {
        console.error('Error clearing local session:', err);
      }
    }
  }
}
