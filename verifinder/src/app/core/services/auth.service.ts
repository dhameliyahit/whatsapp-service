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
  readonly loadingMessage = signal<string>('Verifying with server...');
  readonly authError = signal<string | null>(null);

  private tokenClient: any = null;
  private cachedClientId: string | null = null;
  private safetyTimeoutHandle: any = null;

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
   * Check if Google Identity Services SDK is ready, or dynamically load it if missing
   */
  checkGoogleScriptLoaded(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (typeof google !== 'undefined' && (google?.accounts?.id || google?.accounts?.oauth2)) {
      this.isGoogleLoaded.set(true);
      return;
    }

    // Check if script tag exists in DOM
    let script = document.querySelector('script[src*="accounts.google.com/gsi/client"]') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const interval = setInterval(() => {
      if (typeof google !== 'undefined' && (google?.accounts?.id || google?.accounts?.oauth2)) {
        this.isGoogleLoaded.set(true);
        clearInterval(interval);
      }
    }, 150);

    setTimeout(() => {
      clearInterval(interval);
      if (typeof google !== 'undefined' && (google?.accounts?.id || google?.accounts?.oauth2)) {
        this.isGoogleLoaded.set(true);
      }
    }, 10000);
  }

  /**
   * Resolve Google Client ID from environment or backend config
   */
  async getGoogleClientId(): Promise<string> {
    if (this.cachedClientId) {
      return this.cachedClientId;
    }

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

    if (clientId) {
      this.cachedClientId = clientId;
    }
    return clientId || '';
  }

  /**
   * Initializes Google Identity Services (One Tap + OAuth2 client)
   */
  async initializeGoogleSignIn(callback?: (credential: string) => void): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const clientId = await this.getGoogleClientId();

    if (typeof google !== 'undefined' && clientId) {
      try {
        if (google.accounts?.id && callback) {
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
        }
        this.isGoogleLoaded.set(true);
      } catch (err) {
        console.warn('Google Identity initialization notice:', err);
      }
    }
  }

  /**
   * Renders the official Google Sign-In button into a container element
   */
  async renderGoogleButton(
    container: HTMLElement,
    onSuccess: (credential: string) => void,
    options?: any
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !container) return;

    await this.initializeGoogleSignIn(onSuccess);

    if (typeof google !== 'undefined' && google?.accounts?.id) {
      try {
        google.accounts.id.renderButton(
          container,
          Object.assign(
            {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
            },
            options || {}
          )
        );
      } catch (err) {
        console.warn('Failed to render Google button:', err);
      }
    }
  }

  /**
   * Prompt Google One-Tap if available
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
   * Primary Interactive Google Sign-In Trigger:
   * Sets instant loading state, opens Google OAuth popup, and authenticates
   */
  async signInWithGoogle(redirectUrl: string = '/dashboard'): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;

    // 1. Instant loading feedback on click
    this.isLoading.set(true);
    this.loadingMessage.set('Connecting to Google...');
    this.authError.set(null);

    // Clear any previous safety timeout
    if (this.safetyTimeoutHandle) {
      clearTimeout(this.safetyTimeoutHandle);
    }
    // Safety auto-reset timeout (60 seconds) in case browser popup is closed without firing events
    this.safetyTimeoutHandle = setTimeout(() => {
      if (this.isLoading()) {
        this.isLoading.set(false);
      }
    }, 60000);

    try {
      const clientId = await this.getGoogleClientId();
      if (!clientId) {
        throw new Error('Google Client ID is not configured. Please check server configuration.');
      }

      // Check if Google SDK is loaded; if not, wait briefly
      if (typeof google === 'undefined' || (!google?.accounts?.oauth2 && !google?.accounts?.id)) {
        this.checkGoogleScriptLoaded();
        let retries = 0;
        while ((typeof google === 'undefined' || (!google?.accounts?.oauth2 && !google?.accounts?.id)) && retries < 15) {
          await new Promise(r => setTimeout(r, 200));
          retries++;
        }
      }

      if (typeof google === 'undefined' || !google?.accounts) {
        throw new Error('Could not connect to Google services. Please check your internet connection or ad-blocker.');
      }

      // Approach 1: OAuth 2.0 Token Client (Official GIS popup for custom buttons)
      if (google.accounts?.oauth2) {
        return await new Promise<boolean>((resolve) => {
          let hasReceivedToken = false;
          let isAuthenticating = false;
          let isCompleted = false;

          try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: 'email profile openid',
              callback: async (tokenResponse: any) => {
                if (tokenResponse?.access_token) {
                  hasReceivedToken = true;
                  isAuthenticating = true;
                  this.authError.set(null);
                  this.loadingMessage.set('Authenticating with server...');

                  const ok = await this.loginWithGoogleBackend(
                    { accessToken: tokenResponse.access_token },
                    redirectUrl
                  );
                  isCompleted = true;
                  isAuthenticating = false;
                  resolve(ok);
                } else if (tokenResponse?.error) {
                  hasReceivedToken = true;
                  this.isLoading.set(false);
                  this.authError.set(`Google sign-in error: ${tokenResponse.error_description || tokenResponse.error}`);
                  resolve(false);
                } else {
                  this.isLoading.set(false);
                  resolve(false);
                }
              },
              error_callback: (error: any) => {
                // If token was already received or we are authenticating, do not interrupt!
                if (hasReceivedToken || isAuthenticating || isCompleted) {
                  return;
                }

                // If popup was closed:
                if (error?.type === 'popup_closed') {
                  // Give a 1500ms grace period because the window-close event can fire before or concurrently with token delivery
                  setTimeout(() => {
                    if (hasReceivedToken || isAuthenticating || isCompleted) {
                      return; // Token arrived during grace period! Not an error.
                    }
                    this.isLoading.set(false);
                    // Do not show an error banner when the user simply closes the popup
                    this.authError.set(null);
                    resolve(false);
                  }, 1500);
                  return;
                }

                this.isLoading.set(false);
                if (error?.type === 'popup_failed_to_open') {
                  this.authError.set('Popup was blocked by your browser. Please allow popups for this site.');
                } else {
                  this.authError.set(error?.message || 'Google authentication was cancelled.');
                }
                resolve(false);
              },
            });

            // Trigger popup
            this.loadingMessage.set('Waiting for Google authorization...');
            this.tokenClient.requestAccessToken({ prompt: 'select_account' });
          } catch (initErr: any) {
            console.error('Error initiating OAuth2 token client:', initErr);
            this.isLoading.set(false);
            this.authError.set(initErr?.message || 'Failed to open Google Sign-In.');
            resolve(false);
          }
        });
      }

      // Approach 2: One Tap / ID Token fallback if oauth2 is not available
      if (google.accounts?.id) {
        return await new Promise<boolean>((resolve) => {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: GoogleAuthResponse) => {
              if (response?.credential) {
                this.loadingMessage.set('Authenticating with server...');
                const ok = await this.loginWithGoogleBackend(
                  { idToken: response.credential },
                  redirectUrl
                );
                resolve(ok);
              } else {
                this.isLoading.set(false);
                resolve(false);
              }
            },
            cancel_on_tap_outside: true,
          });

          google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed()) {
              this.isLoading.set(false);
              this.authError.set(
                `Google prompt suppressed (${notification.getNotDisplayedReason() || 'unknown'}). Please click again or enable popups.`
              );
              resolve(false);
            } else if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
              this.isLoading.set(false);
              resolve(false);
            }
          });
        });
      }

      throw new Error('Google authentication library could not be initialized.');
    } catch (err: any) {
      this.isLoading.set(false);
      const message = err?.message || 'Failed to start Google sign-in.';
      this.authError.set(message);
      return false;
    }
  }

  /**
   * Authenticate with backend API using Google credential token or access token
   */
  async loginWithGoogleBackend(
    tokenInput: string | { idToken?: string; accessToken?: string },
    redirectUrl: string = '/dashboard'
  ): Promise<boolean> {
    this.isLoading.set(true);
    this.authError.set(null);

    const payload =
      typeof tokenInput === 'string'
        ? tokenInput.startsWith('ya29.')
          ? { accessToken: tokenInput }
          : { idToken: tokenInput }
        : tokenInput;

    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<AuthResponseData>>(`${environment.apiUrl}/auth/google`, payload)
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
      try {
        const navigated = await this.router.navigateByUrl(redirectUrl);
        if (!navigated) {
          await this.router.navigate(['/dashboard']);
        }
      } catch (navErr) {
        console.warn('[AuthService] Router navigation notice:', navErr);
        if (isPlatformBrowser(this.platformId)) {
          window.location.href = redirectUrl || '/dashboard';
        }
      }
      return true;
    } catch (error: any) {
      const msg =
        error?.error?.message ||
        error?.message ||
        (error?.status === 0
          ? 'Unable to reach backend server. Please verify the server is running.'
          : 'Backend authentication failed.');
      this.authError.set(msg);
      return false;
    } finally {
      this.isLoading.set(false);
      if (this.safetyTimeoutHandle) {
        clearTimeout(this.safetyTimeoutHandle);
        this.safetyTimeoutHandle = null;
      }
    }
  }

  /**
   * Developer login bypass for local development/testing
   */
  async loginWithDevMock(redirectUrl: string = '/dashboard'): Promise<boolean> {
    this.loadingMessage.set('Signing in with Developer credentials...');
    return this.loginWithGoogleBackend({ accessToken: 'dev-mock-token' }, redirectUrl);
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
