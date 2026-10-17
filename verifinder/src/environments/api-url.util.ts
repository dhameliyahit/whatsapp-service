/**
 * Dynamically resolves the base API URL.
 * In production/UAT, it seamlessly adapts to:
 * 1. Runtime environment variables injected into the window object (window.__ENV?.API_URL)
 * 2. The live hosting origin (e.g., https://your-uat-domain.com/api)
 * 3. Default local development backend (http://localhost:5000/api)
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const runtimeUrl =
      (window as any)?.__ENV?.API_URL ||
      (window as any)?.__env?.apiUrl ||
      (window as any)?.API_URL;
    if (runtimeUrl && typeof runtimeUrl === 'string') {
      return runtimeUrl.replace(/\/+$/, '');
    }

    if (window.location.port !== '4200') {
      return `${window.location.origin}/api`;
    }
  }
  return 'http://localhost:5000/api';
}
