import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

// GET /api/logs?page=1&q=검색어
export async function GET(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    const sp = new URL(req.url).searchParams;
    let page = Math.max(1, Math.trunc(Number(sp.get('page')) || 1));
    const q = String(sp.get('q') || '').trim();
    const offset = (page - 1) * PAGE_SIZE;

    let total, rows;
    if (q) {
      const like = '%' + q + '%';
      total = Number((await sql`
        SELECT COUNT(*)::int AS c FROM edit_log
        WHERE user_id ILIKE ${like} OR brand ILIKE ${like} OR pattern ILIKE ${like}
           OR size ILIKE ${like} OR field ILIKE ${like} OR value ILIKE ${like}
      `).rows[0].c);
      ({ rows } = await sql`
        SELECT id,
          to_char(ts AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS ymd,
          to_char(ts AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS hms,
          user_id, brand, pattern, size, field, value
        FROM edit_log
        WHERE user_id ILIKE ${like} OR brand ILIKE ${like} OR pattern ILIKE ${like}
           OR size ILIKE ${like} OR field ILIKE ${like} OR value ILIKE ${like}
        ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `);
    } else {
      total = Number((await sql`SELECT COUNT(*)::int AS c FROM edit_log`).rows[0].c);
      ({ rows } = await sql`
        SELECT id,
          to_char(ts AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS ymd,
          to_char(ts AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS hms,
          user_id, brand, pattern, size, field, value
        FROM edit_log
        ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `);
    }
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return NextResponse.json({ ok: true, items: rows, total, page, totalPages, pageSize: PAGE_SIZE, me: me || null });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}

// 삭제 (관리자만): { all: true } 전체  또는  { ids: [...] } 선택
export async function DELETE(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    if (!me) return NextResponse.json({ ok: false, msg: '로그인이 필요합니다' }, { status: 401 });
    if (me.role !== 'admin') return NextResponse.json({ ok: false, msg: '삭제는 관리자만 가능합니다' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (body.all === true) {
      await sql`TRUNCATE TABLE edit_log RESTART IDENTITY`;
      return NextResponse.json({ ok: true, deleted: 'all' });
    }
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ ok: false, msg: '삭제할 항목이 없습니다' }, { status: 400 });
    const r = await sql.query(`DELETE FROM edit_log WHERE id = ANY($1::int[])`, [ids]);
    return NextResponse.json({ ok: true, deleted: r.rowCount || 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
