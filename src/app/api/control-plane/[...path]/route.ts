import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CONTROL_PLANE_API_BASE, CONTROL_PLANE_COOKIE } from '@/lib/control-plane';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const READ_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 250;
const RETRYABLE = new Set([502, 503, 504, 522, 523, 524]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function forward(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const jar = await cookies();
  const token = jar.get(CONTROL_PLANE_COOKIE)?.value;
  if (!token) return NextResponse.json({ success:false, error:{ code:'UNAUTHORIZED', message:'Sessão expirada.' } }, { status:401 });

  const suffix = '/' + path.map(encodeURIComponent).join('/');
  const target = new URL(`${CONTROL_PLANE_API_BASE}/api/v1/control-plane${suffix}`);
  req.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers: Record<string,string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`
  };
  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  const method = req.method.toUpperCase();
  const readOnly = method === 'GET' || method === 'HEAD';
  const body = readOnly ? undefined : await req.text();
  const maxAttempts = readOnly ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const upstream = await fetch(target, {
        method,
        headers,
        body,
        cache:'no-store',
        signal: readOnly ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined
      });
      const text = await upstream.text();

      if (readOnly && RETRYABLE.has(upstream.status) && attempt < maxAttempts) {
        console.warn(`[control-plane.proxy.retry] path=${suffix} status=${upstream.status} attempt=${attempt}`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (upstream.status === 401) {
        const response = new NextResponse(text || JSON.stringify({success:false}), { status:401, headers:{'Content-Type':'application/json'} });
        response.cookies.set(CONTROL_PLANE_COOKIE, '', { httpOnly:true, secure:true, sameSite:'strict', path:'/', maxAge:0 });
        return response;
      }

      return new NextResponse(text, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
      });
    } catch (error) {
      if (readOnly && attempt < maxAttempts) {
        console.warn(`[control-plane.proxy.retry] path=${suffix} network_error attempt=${attempt}`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      console.error(`[control-plane.proxy.upstream] path=${suffix} method=${method}`, error);
      return NextResponse.json({
        success: false,
        error: {
          code: 'CONTROL_PLANE_UPSTREAM_TIMEOUT',
          message: 'A API do Control Plane não respondeu dentro do limite operacional.'
        }
      }, { status: 504 });
    }
  }

  return NextResponse.json({
    success: false,
    error: {
      code: 'CONTROL_PLANE_UPSTREAM_TIMEOUT',
      message: 'A API do Control Plane não respondeu dentro do limite operacional.'
    }
  }, { status: 504 });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
