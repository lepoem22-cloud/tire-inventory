import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const COLS = `id, brand, pattern, pcode, size, pr, dot, factory, qty,
  mount, direct, daily_del, ping_del, ping_dir, store11, storefarm, lotte,
  dc_rate, dc_price, note`;

export async function GET() {
  try {
    const me = currentUser();
    let rows, memoRows;
    try {
      ({ rows } = await sql.query(`SELECT ${COLS} FROM tires ORDER BY id ASC`));
      ({ rows: memoRows } = await sql.query(
        `SELECT tire_pk, channel, COUNT(*)::int AS c FROM ship_memo GROUP BY tire_pk, channel`
      ));
    } catch (e) {
      await ensureSchema();
      ({ rows } = await sql.query(`SELECT ${COLS} FROM tires ORDER BY id ASC`));
      ({ rows: memoRows } = await sql.query(
        `SELECT tire_pk, channel, COUNT(*)::int AS c FROM ship_memo GROUP BY tire_pk, channel`
      ));
    }
    // 품목별 채널별 메모 개수 맵: { tire_pk: { direct: n, daily_del: m } }
    const memo = {};
    for (const m of (memoRows || [])) {
      (memo[m.tire_pk] || (memo[m.tire_pk] = {}))[m.channel] = m.c;
    }
    for (const r of rows) r.memoCount = memo[r.id] || {};
    return NextResponse.json({ ok: true, items: rows, me: me || null });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
