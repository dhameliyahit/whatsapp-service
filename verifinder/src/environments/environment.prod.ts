import { getApiBaseUrl } from './api-url.util';
export { getApiBaseUrl };

export const environment = {
  production: true,
  get googleClientId(): string {
    if (typeof window !== 'undefined') {
      return (
        (window as any)?.__ENV?.GOOGLE_CLIENT_ID ||
        (window as any)?.GOOGLE_CLIENT_ID ||
        '657925289421-5a4mtpip1hevqgvbc64lm2evktrdbg5k.apps.googleusercontent.com'
      );
    }
    return '657925289421-5a4mtpip1hevqgvbc64lm2evktrdbg5k.apps.googleusercontent.com';
  },
  get apiUrl(): string {
    return getApiBaseUrl();
  }
};
