import { getApiBaseUrl } from './api-url.util';
export { getApiBaseUrl };

export const environment = {
  production: false,
  get googleClientId(): string {
    if (typeof window !== 'undefined') {
      return (window as any)?.__ENV?.GOOGLE_CLIENT_ID || (window as any)?.GOOGLE_CLIENT_ID || '';
    }
    return '';
  },
  get apiUrl(): string {
    return getApiBaseUrl();
  }
};
