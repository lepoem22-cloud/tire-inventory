import { NextResponse } from 'next/server';
import crypto from 'crypto';

const COOKIE = 'tire_session';
const SECRET = process.env.AUTH_SECRET || 'tire-default-secret-change-me';

function valid(token) {
  if (!token || !token.includes('.')) return false;
  const [body, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return mac === expect;
}

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }
  const token = req.cookies.get(COOKIE)?.value;
  if (!valid(token)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, msg: '로그인이 필요합니다' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
