import { cookies } from 'next/headers';

export const CONTROL_PLANE_COOKIE = 'xpay_cp_session';
export const CONTROL_PLANE_API_BASE = (process.env.XPAYMENTS_API_URL || 'https://api.xpayments.digital').replace(/\/$/, '');

export type ControlPlaneUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions?: Record<string, boolean>;
};

export type ControlPlaneResult = {
  ok: boolean;
  status: number;
  payload: unknown;
};

export async function controlPlaneFetch(path: string, init: RequestInit = {}): Promise<ControlPlaneResult> {
  const jar = await cookies();
  const token = jar.get(CONTROL_PLANE_COOKIE)?.value;

  if (!token) {
    return { ok: false, status: 401, payload: null };
  }

  const response = await fetch(`${CONTROL_PLANE_API_BASE}/api/v1/control-plane${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === 'object') as Record<string, unknown>[]
    : [];
}

export function apiData(payload: unknown): Record<string, unknown> {
  return asRecord(asRecord(payload).data);
}
