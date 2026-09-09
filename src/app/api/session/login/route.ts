import { NextRequest, NextResponse } from 'next/server';
import { CONTROL_PLANE_API_BASE, CONTROL_PLANE_COOKIE, asRecord } from '@/lib/control-plane';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const input = asRecord(body);
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');

  if (!email || !password) {
    return NextResponse.json({ success: false, message: 'Email e password são obrigatórios.' }, { status: 400 });
  }

  const upstream = await fetch(`${CONTROL_PLANE_API_BASE}/api/v1/control-plane/auth/login`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const payload = asRecord(await upstream.json().catch(() => ({})));
  const data = asRecord(payload.data);
  const user = asRecord(data.user);
  const token = String(data.token || '');

  if (!upstream.ok || !token) {
    const error = asRecord(payload.error);
    return NextResponse.json(
      { success: false, message: String(error.message || 'Credenciais inválidas.') },
      { status: upstream.status || 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    user: {
      id: String(user.id || ''),
      name: String(user.name || ''),
      email: String(user.email || ''),
      role: String(user.role || '')
    }
  });

  response.cookies.set(CONTROL_PLANE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 12
  });

  return response;
}
