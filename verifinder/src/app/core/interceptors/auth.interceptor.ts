import { HttpInterceptorFn, HttpErrorResponse, HttpClient } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const http = inject(HttpClient);

  if (isPlatformBrowser(platformId) && req.url.startsWith(environment.apiUrl)) {
    const token = localStorage.getItem('verifinder_access_token');
    if (token) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 401 &&
        isPlatformBrowser(platformId) &&
        !req.url.includes('/auth/refresh') &&
        !req.url.includes('/auth/google')
      ) {
        const refreshToken = localStorage.getItem('verifinder_refresh_token');
        if (refreshToken) {
          return http.post<any>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
            switchMap((res) => {
              const newAccessToken = res?.data?.accessToken;
              if (newAccessToken) {
                localStorage.setItem('verifinder_access_token', newAccessToken);
                if (res?.data?.refreshToken) {
                  localStorage.setItem('verifinder_refresh_token', res.data.refreshToken);
                }
                const retriedReq = req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${newAccessToken}`
                  }
                });
                return next(retriedReq);
              }
              localStorage.removeItem('verifinder_access_token');
              localStorage.removeItem('verifinder_auth_user');
              router.navigate(['/login']);
              return throwError(() => error);
            }),
            catchError((refreshErr) => {
              localStorage.removeItem('verifinder_access_token');
              localStorage.removeItem('verifinder_auth_user');
              router.navigate(['/login']);
              return throwError(() => refreshErr);
            })
          );
        } else {
          localStorage.removeItem('verifinder_access_token');
          localStorage.removeItem('verifinder_auth_user');
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
