import { NextResponse } from 'next/server';
import { checkLogin, makeToken, COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { id, pw } = await req.json();
    const user = checkLogin(String(id || '').trim(), String(pw || ''));
    if (!user) return NextResponse.json({ ok: false, msg: '아이디 또는 비밀번호가 올바르지 않습니다' }, { status: 401 });
    const res = NextResponse.json({ ok: true, id: user.id, role: user.role });
    res.cookies.set(COOKIE, makeToken(user), {
      httpOnly: true, sameSite: 'lax', secure: true, path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
