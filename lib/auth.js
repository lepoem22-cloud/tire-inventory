import { cookies } from 'next/headers';
import crypto from 'crypto';

export const COOKIE = 'tire_session';
const SECRET = process.env.AUTH_SECRET || 'tire-default-secret-change-me';

// ── 계정 정의 (코드/환경변수 고정) ──────────────────
//  관리자: ADMIN_ID / ADMIN_PW (없으면 기본값)
//  직원 공용/추가 계정: STAFF_ACCOUNTS = "id1:pw1,id2:pw2"
function accounts() {
  const list = [
    {
      id: process.env.ADMIN_ID || 'lepoem22',
      pw: process.env.ADMIN_PW || '1q2w3e4r!',
      role: 'admin',
    },
  ];
  (process.env.STAFF_ACCOUNTS || '').split(',').forEach((pair) => {
    const idx = pair.indexOf(':');
    if (idx <= 0) return;
    const id = pair.slice(0, idx).trim();
    const pw = pair.slice(idx + 1).trim();
    if (id && pw) list.push({ id, pw, role: 'staff' });
  });
  return list;
}

// ── 토큰 서명/검증 ─────────────────────────────────
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}
function unsign(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac !== expect) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch (e) { return null; }
}

// ── 공개 API ───────────────────────────────────────
export function checkLogin(id, pw) {
  const acc = accounts().find((a) => a.id === id && a.pw === pw);
  return acc ? { id: acc.id, role: acc.role } : null;
}

export function makeToken(user) {
  return sign({ id: user.id, role: user.role, ts: Date.now() });
}

// 토큰 문자열 → {id, role} (미들웨어/라우트 공용)
export function verifyToken(token) {
  return unsign(token);
}

// 현재 로그인 사용자 (서버 라우트에서 호출). {id, role} 또는 null
export function currentUser() {
  const token = cookies().get(COOKIE)?.value;
  return unsign(token);
}
