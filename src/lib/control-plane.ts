import { cookies } from 'next/headers';

export const CONTROL_PLANE_COOKIE = 'xpay_cp_session';
export const CONTROL_PLANE_API_BASE = (process.env.XPAYMENTS_API_URL || 'https://api.xpayments.digital').replace(/\/$/, '');

const CONTROL_PLANE_READ_TIMEOUT_MS = 8_000;
const CONTROL_PLANE_RETRY_DELAY_MS = 250;
const RETRYABLE_UPSTREAM_STATUSES = new Set([502, 503, 504, 522, 523, 524]);

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function controlPlaneFetch(path: string, init: RequestInit = {}): Promise<ControlPlaneResult> {
  const jar = await cookies();
  const token = jar.get(CONTROL_PLANE_COOKIE)?.value;

  if (!token) {
    return { ok: false, status: 401, payload: null };
  }

  const method = String(init.method || 'GET').toUpperCase();
  const readOnly = method === 'GET' || method === 'HEAD';
  const maxAttempts = readOnly ? 2 : 1;
  const url = `${CONTROL_PLANE_API_BASE}/api/v1/control-plane${path}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        cache: 'no-store',
        signal: readOnly ? AbortSignal.timeout(CONTROL_PLANE_READ_TIMEOUT_MS) : init.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init.headers || {})
        }
      });

      const payload = await response.json().catch(() => null);
      const retryable = readOnly && RETRYABLE_UPSTREAM_STATUSES.has(response.status);

      if (retryable && attempt < maxAttempts) {
        console.warn(`[control-plane.read.retry] path=${path} status=${response.status} attempt=${attempt}`);
        await sleep(CONTROL_PLANE_RETRY_DELAY_MS);
        continue;
      }

      return { ok: response.ok, status: response.status, payload };
    } catch (error) {
      if (readOnly && attempt < maxAttempts) {
        console.warn(`[control-plane.read.retry] path=${path} network_error attempt=${attempt}`);
        await sleep(CONTROL_PLANE_RETRY_DELAY_MS);
        continue;
      }

      console.error(`[control-plane.upstream] path=${path} method=${method}`, error);
      return {
        ok: false,
        status: 504,
        payload: {
          success: false,
          error: {
            code: 'CONTROL_PLANE_UPSTREAM_TIMEOUT',
            message: 'A API do Control Plane não respondeu dentro do limite operacional.'
          }
        }
      };
    }
  }

  return {
    ok: false,
    status: 504,
    payload: {
      success: false,
      error: {
        code: 'CONTROL_PLANE_UPSTREAM_TIMEOUT',
        message: 'A API do Control Plane não respondeu dentro do limite operacional.'
      }
    }
  };
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
