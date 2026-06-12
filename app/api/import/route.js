import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

function n(v) {
  const x = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(x) ? Math.trunc(x) : 0;
}
function f(v) {
  const x = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(x) ? x : 0;
}
function s(v) {
  return v == null ? '' : String(v).trim();
}

export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (body.replace === true) {
      await sql`TRUNCATE TABLE tires RESTART IDENTITY`;
    }
    let inserted = 0;
    for (const r of rows) {
      if (!s(r.brand) && !s(r.pattern)) continue;
      await sql`
        INSERT INTO tires
          (brand, pattern, pcode, size, pr, dot, factory, qty,
           mount, direct, daily_del, ping_del, ping_dir, store11, storefarm, lotte,
           dc_rate, dc_price, tire_id, product_code, note)
        VALUES
          (${s(r.brand)}, ${s(r.pattern)}, ${s(r.pcode)}, ${s(r.size)}, ${s(r.pr)}, ${s(r.dot)},
           ${n(r.factory)}, ${n(r.qty)},
           ${n(r.mount)}, ${n(r.direct)}, ${n(r.daily_del)}, ${n(r.ping_del)}, ${n(r.ping_dir)},
           ${n(r.store11)}, ${n(r.storefarm)}, ${n(r.lotte)},
           ${f(r.dc_rate)}, ${n(r.dc_price)},
           ${s(r.tire_id)}, ${s(r.product_code)}, ${s(r.note)})
      `;
      inserted++;
    }
    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
