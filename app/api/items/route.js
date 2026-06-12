import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 화면에 실제로 쓰는 컬럼만 선택 (불필요한 product_code/updated_at 등 제외 → 전송량↓)
const COLS = `id, brand, pattern, pcode, size, pr, dot, factory, qty,
  mount, direct, daily_del, ping_del, ping_dir, store11, storefarm, lotte,
  dc_rate, dc_price, note`;

export async function GET() {
  try {
    const me = currentUser();
    let rows;
    try {
      ({ rows } = await sql.query(`SELECT ${COLS} FROM tires ORDER BY id ASC`));
    } catch (e) {
      // 테이블이 아직 없으면 한 번만 생성 후 재시도
      await ensureSchema();
      ({ rows } = await sql.query(`SELECT ${COLS} FROM tires ORDER BY id ASC`));
    }
    return NextResponse.json({ ok: true, items: rows, me: me || null });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
