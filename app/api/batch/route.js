import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 수정 허용 컬럼 (시트처럼 전 열 입력 가능)
const TEXT_FIELDS = new Set(['brand', 'pattern', 'pcode', 'size', 'pr', 'dot', 'note', 'tire_id', 'product_code']);
const NUM_FIELDS = new Set([
  'factory', 'qty', 'mount', 'direct', 'daily_del',
  'ping_del', 'ping_dir', 'store11', 'storefarm', 'lotte', 'dc_price',
]);
const FLOAT_FIELDS = new Set(['dc_rate']);

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
    const body = await req.json();
    const updates = Array.isArray(body.updates) ? body.updates : [];
    const user = String(body.user || '').trim() || '미지정';
    let n = 0;

    for (const u of updates) {
      const id = Number(u.id);
      const f = String(u.field || '');
      if (!id) continue;

      let val;
      if (TEXT_FIELDS.has(f)) val = String(u.value ?? '').trim();
      else if (NUM_FIELDS.has(f)) val = toN(u.value);
      else if (FLOAT_FIELDS.has(f)) val = toF(u.value);
      else continue; // 허용되지 않은 컬럼은 무시

      // 컬럼명은 화이트리스트 통과분만 사용하므로 안전
      const { rows } = await sql.query(
        `UPDATE tires SET ${f} = $1, updated_at = now() WHERE id = $2 RETURNING brand, pattern, size`,
        [val, id]
      );
      n++;

      // 사용기록 남기기 (실패해도 저장은 유지)
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

    return NextResponse.json({ ok: true, updated: n });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
