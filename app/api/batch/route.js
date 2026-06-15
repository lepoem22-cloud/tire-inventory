import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 수정 허용 컬럼
const TEXT_FIELDS = new Set(['brand', 'pattern', 'pcode', 'size', 'pr', 'dot', 'note', 'tire_id', 'product_code']);
const NUM_FIELDS = new Set([
  'factory', 'qty', 'mount', 'direct', 'daily_del',
  'ping_del', 'ping_dir', 'store11', 'storefarm', 'lotte', 'dc_price',
]);
const FLOAT_FIELDS = new Set(['dc_rate']);

// A~H열 = 관리자만 수정 가능 (브랜드~수량)
const ADMIN_ONLY = new Set(['brand', 'pattern', 'pcode', 'size', 'pr', 'dot', 'factory', 'qty']);

// 사용기록을 남길 필드: H(수량) + J~Q(출고 8개)
const LOGGED_FIELDS = new Set(['qty', 'mount', 'direct', 'daily_del', 'ping_del', 'ping_dir', 'store11', 'storefarm', 'lotte']);

function toN(v) {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? Math.trunc(n) : 0;
}
function toF(v) {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : 0;
}

export async function POST(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    if (!me) return NextResponse.json({ ok: false, msg: '로그인이 필요합니다' }, { status: 401 });

    const body = await req.json();
    const updates = Array.isArray(body.updates) ? body.updates : [];
    const user = me.id;
    const isAdmin = me.role === 'admin';
    let n = 0;
    let blocked = 0;

    for (const u of updates) {
      const id = Number(u.id);
      const f = String(u.field || '');
      if (!id) continue;

      // 권한 차단: 일반 직원은 A~H 수정 불가
      if (!isAdmin && ADMIN_ONLY.has(f)) { blocked++; continue; }

      let val;
      if (TEXT_FIELDS.has(f)) val = String(u.value ?? '').trim();
      else if (NUM_FIELDS.has(f)) val = toN(u.value);
      else if (FLOAT_FIELDS.has(f)) val = toF(u.value);
      else continue;

      // 값이 실제로 바뀐 경우에만 UPDATE + 기록 (변화 없으면 불필요한 기록 방지)
      const { rows } = await sql.query(
        `UPDATE tires SET ${f} = $1, updated_at = now()
         WHERE id = $2 AND ${f} IS DISTINCT FROM $1
         RETURNING brand, pattern, size`,
        [val, id]
      );
      if (!rows.length) continue; // 변화 없음 → 기록 안 남김
      n++;

      // 사용기록은 H~Q(수량 + 출고 8개)를 수정했을 때만 남김
      if (LOGGED_FIELDS.has(f)) {
        try {
          const info = rows[0] || {};
          await sql.query(
            `INSERT INTO edit_log (user_id, tire_pk, brand, pattern, size, field, value)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [user, id, info.brand || '', info.pattern || '', info.size || '', f, String(u.value ?? '')]
          );
        } catch (logErr) {
          console.error('사용기록 저장 실패:', logErr);
        }
      }
    }

    return NextResponse.json({ ok: true, updated: n, blocked });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
