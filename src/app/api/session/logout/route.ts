import { NextRequest, NextResponse } from 'next/server';
import { CONTROL_PLANE_API_BASE, CONTROL_PLANE_COOKIE } from '@/lib/control-plane';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(CONTROL_PLANE_COOKIE)?.value;

  if (token) {
    await fetch(`${CONTROL_PLANE_API_BASE}/api/v1/control-plane/auth/logout`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    }).catch(() => null);
  }

  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.set(CONTROL_PLANE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0
  });

  return response;
}
