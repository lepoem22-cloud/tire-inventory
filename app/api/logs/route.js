import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT
        to_char(ts AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS ymd,
        to_char(ts AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS hms,
        user_id, brand, pattern, size, field, value
      FROM edit_log
      ORDER BY id DESC
      LIMIT 2000
    `;
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
