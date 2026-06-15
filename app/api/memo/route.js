import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CHANNEL_KO = { direct: '직배(K)', daily_del: '택배(L)' };

// 특정 품목의 메모 이력 조회: /api/memo?id=123
export async function GET(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    if (!me) return NextResponse.json({ ok: false, msg: '로그인 필요' }, { status: 401 });
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ ok: true, items: [] });
    const { rows } = await sql`
      SELECT id,
        to_char(ts AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS at,
        user_id, channel, memo
      FROM ship_memo WHERE tire_pk = ${id} ORDER BY id ASC
    `;
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}

// 메모 추가: { id, channel: 'direct'|'daily_del', memo }
export async function POST(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    if (!me) return NextResponse.json({ ok: false, msg: '로그인 필요' }, { status: 401 });
    const { id, channel, memo } = await req.json();
    const tid = Number(id);
    const ch = String(channel || '');
    const text = String(memo || '').trim();
    if (!tid || !text) return NextResponse.json({ ok: false, msg: '내용 없음' }, { status: 400 });

    await sql`
      INSERT INTO ship_memo (user_id, tire_pk, channel, memo)
      VALUES (${me.id}, ${tid}, ${ch}, ${text})
    `;

    // 사용기록에도 남김
    try {
      const info = (await sql`SELECT brand, pattern, size FROM tires WHERE id = ${tid}`).rows[0] || {};
      await sql`
        INSERT INTO edit_log (user_id, tire_pk, brand, pattern, size, field, value)
        VALUES (${me.id}, ${tid}, ${info.brand || ''}, ${info.pattern || ''}, ${info.size || ''},
                ${(CHANNEL_KO[ch] || ch) + ' 메모'}, ${text})
      `;
    } catch (e) {}

    // 갱신된 이력 반환
    const { rows } = await sql`
      SELECT id,
        to_char(ts AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS at,
        user_id, channel, memo
      FROM ship_memo WHERE tire_pk = ${tid} ORDER BY id ASC
    `;
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}

// 메모 삭제: /api/memo?memoId=5  (개별)  또는  /api/memo?id=123&all=1 (해당 품목 채널 전체)
export async function DELETE(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    if (!me) return NextResponse.json({ ok: false, msg: '로그인 필요' }, { status: 401 });
    const sp = new URL(req.url).searchParams;
    const memoId = Number(sp.get('memoId'));
    const tid = Number(sp.get('id'));
    const channel = String(sp.get('channel') || '');

    if (memoId) {
      await sql`DELETE FROM ship_memo WHERE id = ${memoId}`;
    } else if (tid && channel) {
      await sql`DELETE FROM ship_memo WHERE tire_pk = ${tid} AND channel = ${channel}`;
    } else if (tid) {
      await sql`DELETE FROM ship_memo WHERE tire_pk = ${tid}`;
    } else {
      return NextResponse.json({ ok: false, msg: '대상 없음' }, { status: 400 });
    }

    // 삭제 후 해당 품목 이력 반환
    const items = tid
      ? (await sql`
          SELECT id, to_char(ts AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS at,
            user_id, channel, memo
          FROM ship_memo WHERE tire_pk = ${tid} ORDER BY id ASC
        `).rows
      : [];
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}
