// ═══════════════════════════════════════════════════════════════════
// API Abstraction Layer — v1 (Backend-Ready)
// 
// Currently: calls go to local Zustand store (demo mode)
// Future: swap implementations to real REST API endpoints
// 
// This layer exists so that when backend is built (P0 action #1),
// only THIS file needs to change — not 30+ screens.
// ═══════════════════════════════════════════════════════════════════

// When backend exists, this will be the base URL
const API_BASE = import.meta.env.VITE_API_URL ?? '';

// Demo mode flag — when true, uses local store
export const IS_DEMO = !API_BASE;

/**
 * Generic API call wrapper.
 * In demo mode: returns null (caller falls back to local store).
 * In production: makes real HTTP request.
 */
export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T | null> {
  if (IS_DEMO) return null;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Future: add JWT token here
      // 'Authorization': `Bearer ${getToken()}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? `API error ${res.status}`);
  }

  return res.json();
}

// ─── Typed API methods (stubs for future backend) ──────────────

export const ordersApi = {
  create: (payload: any) => apiCall('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  fund: (orderId: string) => apiCall(`/api/orders/${orderId}/fund`, { method: 'POST' }),
  cancel: (orderId: string) => apiCall(`/api/orders/${orderId}/cancel`, { method: 'POST' }),
  submit: (orderId: string) => apiCall(`/api/orders/${orderId}/submit`, { method: 'POST' }),
  confirm: (orderId: string) => apiCall(`/api/orders/${orderId}/confirm`, { method: 'POST' }),
  escalate: (orderId: string) => apiCall(`/api/orders/${orderId}/escalate`, { method: 'POST' }),
};

export const paymentsApi = {
  // Future: YooKassa / CloudPayments integration
  createHold: (orderId: string, amount: number) =>
    apiCall('/api/payments/hold', { method: 'POST', body: JSON.stringify({ orderId, amount }) }),
  releaseToProvider: (orderId: string, milestoneId: string) =>
    apiCall('/api/payments/release', { method: 'POST', body: JSON.stringify({ orderId, milestoneId }) }),
  refund: (orderId: string, amount: number) =>
    apiCall('/api/payments/refund', { method: 'POST', body: JSON.stringify({ orderId, amount }) }),
};

export const authApi = {
  // Future: phone-based auth (SMS OTP)
  sendCode: (phone: string) =>
    apiCall('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyCode: (phone: string, code: string) =>
    apiCall('/api/auth/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }),
};
