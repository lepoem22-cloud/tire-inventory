import { NextResponse } from 'next/server';

const COOKIE = 'tire_session';

// Edge 런타임에서는 Node 'crypto'를 쓸 수 없으므로,
// 미들웨어에서는 쿠키 존재(형식)만 확인하고
// 실제 서명 검증은 각 API/페이지의 currentUser()에서 수행한다.
function looksValid(token) {
  return typeof token === 'string' && token.includes('.') && token.length > 20;
}

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/reset' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }
  const token = req.cookies.get(COOKIE)?.value;
  if (!looksValid(token)) {
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
