import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    if (!me) return NextResponse.json({ ok: false, msg: '로그인이 필요합니다' }, { status: 401 });
    if (me.role !== 'admin') return NextResponse.json({ ok: false, msg: '행 추가는 관리자만 가능합니다' }, { status: 403 });

    const body = await req.json();
    let count = Math.trunc(Number(body.count) || 1);
    if (count < 1) count = 1;
    if (count > 5000) count = 5000;
    // generate_series 로 한 번에 count 개 행 생성 (1행씩 루프보다 훨씬 빠름)
    const { rows } = await sql.query(
      `INSERT INTO tires (brand) SELECT '' FROM generate_series(1, $1) RETURNING *`,
      [count]
    );
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}

// 행 삭제 (관리자만). body: { ids: [1,2,3] }  또는  { all: true } 전체 삭제
export async function DELETE(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    if (!me) return NextResponse.json({ ok: false, msg: '로그인이 필요합니다' }, { status: 401 });
    if (me.role !== 'admin') return NextResponse.json({ ok: false, msg: '행 삭제는 관리자만 가능합니다' }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    if (body.all === true) {
      // 전체 삭제 + id 시퀀스 리셋 (다음 추가 시 1번부터)
      await sql`TRUNCATE TABLE tires RESTART IDENTITY`;
      return NextResponse.json({ ok: true, deleted: 'all' });
    }

    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ ok: false, msg: '삭제할 행이 없습니다' }, { status: 400 });

    const r = await sql.query(
      `DELETE FROM tires WHERE id = ANY($1::int[])`,
      [ids]
    );
    // 해당 행들의 출고 메모도 정리
    try { await sql.query(`DELETE FROM ship_memo WHERE tire_pk = ANY($1::int[])`, [ids]); } catch (e) {}

    return NextResponse.json({ ok: true, deleted: r.rowCount || 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
