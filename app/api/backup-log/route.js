import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT ymd, hm, brand, pattern, pcode, size, pr, dot,
             qty, mount, direct, daily_del, ping_del, ping_dir,
             store11, storefarm, lotte, sales_total, new_qty
      FROM backup_log
      ORDER BY id DESC
      LIMIT 2000
    `;
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
