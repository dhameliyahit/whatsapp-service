import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DashboardOverviewComponent } from './pages/dashboard/components/dashboard-overview/dashboard-overview.component';
import { OtpMessagingComponent } from './pages/dashboard/components/otp-messaging/otp-messaging.component';
import { MessageLogsComponent } from './pages/dashboard/components/message-logs/message-logs.component';
import { ApiKeysComponent } from './pages/dashboard/components/api-keys/api-keys.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
    title: 'Login — Verifinder'
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: DashboardOverviewComponent,
        title: 'Dashboard — Verifinder'
      },
      {
        path: 'send-otp',
        component: OtpMessagingComponent,
        title: 'Send OTP — Verifinder'
      },
      {
        path: 'logs',
        component: MessageLogsComponent,
        title: 'Message Logs — Verifinder'
      },
      {
        path: 'api-keys',
        component: ApiKeysComponent,
        title: 'API & Developer — Verifinder'
      },
      {
        path: 'otp',
        redirectTo: 'send-otp',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'send-otp',
    redirectTo: 'dashboard/send-otp',
    pathMatch: 'full'
  },
  {
    path: 'otp',
    redirectTo: 'dashboard/send-otp',
    pathMatch: 'full'
  },
  {
    path: 'logs',
    redirectTo: 'dashboard/logs',
    pathMatch: 'full'
  },
  {
    path: 'api-keys',
    redirectTo: 'dashboard/api-keys',
    pathMatch: 'full'
  },
  {
    path: 'gateway',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
