import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = currentUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, id: me.id, role: me.role });
}
