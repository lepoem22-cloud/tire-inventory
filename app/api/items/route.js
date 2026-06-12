import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSchema();
    const me = currentUser();
    const { rows } = await sql`SELECT * FROM tires ORDER BY id ASC`;
    return NextResponse.json({ ok: true, items: rows, me: me || null });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
