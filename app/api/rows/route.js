import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const user = String(body.user || '').trim() || '미지정';
    let count = Math.trunc(Number(body.count) || 1);
    if (count < 1) count = 1;
    if (count > 500) count = 500;
    const items = [];
    for (let i = 0; i < count; i++) {
      const { rows } = await sql`INSERT INTO tires DEFAULT VALUES RETURNING *`;
      items.push(rows[0]);
    }
    try {
      await sql.query(
        `INSERT INTO edit_log (user_id, field, value) VALUES ($1, '행추가', $2)`,
        [user, String(items.length) + '행']
      );
    } catch (e) {}
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
