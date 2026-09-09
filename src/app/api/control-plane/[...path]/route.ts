import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CONTROL_PLANE_API_BASE, CONTROL_PLANE_COOKIE } from '@/lib/control-plane';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const body = ['GET','HEAD'].includes(method) ? undefined : await req.text();
  const upstream = await fetch(target, { method, headers, body, cache:'no-store' });
  const text = await upstream.text();

  if (upstream.status === 401) {
    const response = new NextResponse(text || JSON.stringify({success:false}), { status:401, headers:{'Content-Type':'application/json'} });
    response.cookies.set(CONTROL_PLANE_COOKIE, '', { httpOnly:true, secure:true, sameSite:'strict', path:'/', maxAge:0 });
    return response;
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
