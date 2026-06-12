import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 수정 허용 컬럼 (할인율 dc_rate / 할인가 dc_price 는 보호 → 목록에서 제외)
const TEXT_FIELDS = new Set(['dot', 'note', 'tire_id', 'product_code']);
const NUM_FIELDS = new Set([
  'qty', 'mount', 'direct', 'daily_del',
  'ping_del', 'ping_dir', 'store11', 'storefarm', 'lotte',
]);

function toN(v) {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? Math.trunc(n) : 0;
}

export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const updates = Array.isArray(body.updates) ? body.updates : [];
    let n = 0;

    for (const u of updates) {
      const id = Number(u.id);
      const f = String(u.field || '');
      if (!id) continue;

      if (TEXT_FIELDS.has(f)) {
        const val = String(u.value ?? '').trim();
        // 컬럼명은 화이트리스트 통과분만 사용하므로 안전
        await sql.query(
          `UPDATE tires SET ${f} = $1, updated_at = now() WHERE id = $2`,
          [val, id]
        );
        n++;
      } else if (NUM_FIELDS.has(f)) {
        await sql.query(
          `UPDATE tires SET ${f} = $1, updated_at = now() WHERE id = $2`,
          [toN(u.value), id]
        );
        n++;
      }
      // 그 외 컬럼은 무시 (보호)
    }

    return NextResponse.json({ ok: true, updated: n });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
