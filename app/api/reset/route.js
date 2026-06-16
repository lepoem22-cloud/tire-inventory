import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 출고합계 = J~Q (mount~lotte)
const SALES_SUM = `(mount + direct + daily_del + ping_del + ping_dir + store11 + storefarm + lotte)`;
const SALES_SUM_T = `(t.mount + t.direct + t.daily_del + t.ping_del + t.ping_dir + t.store11 + t.storefarm + t.lotte)`;

async function runReset() {
  await ensureSchema();

  // 1) 출고가 있는 행만 백업 (실패해도 차감은 진행)
  //    그 품목의 ship_memo 들을 모아 note(특이사항)에 넣음
  let backed = 0;
  try {
    const r = await sql.query(`
      INSERT INTO backup_log
        (ymd, hm, tire_pk, brand, pattern, pcode, size, pr, dot,
         factory, qty, mount, direct, daily_del, ping_del, ping_dir,
         store11, storefarm, lotte, tire_id, sales_total, new_qty, note)
      SELECT
        to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'),
        to_char(now() AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS'),
        t.id, t.brand, t.pattern, t.pcode, t.size, t.pr, t.dot,
        t.factory, t.qty, t.mount, t.direct, t.daily_del, t.ping_del, t.ping_dir,
        t.store11, t.storefarm, t.lotte, t.tire_id,
        ${SALES_SUM_T},
        t.qty - ${SALES_SUM_T},
        m.notes
      FROM tires t
      LEFT JOIN (
        SELECT tire_pk,
          string_agg(
            CASE channel WHEN 'direct' THEN 'K' WHEN 'daily_del' THEN 'L' ELSE channel END
            || ': ' || memo, E'\\n' ORDER BY id
          ) AS notes
        FROM ship_memo GROUP BY tire_pk
      ) m ON m.tire_pk = t.id
      WHERE ${SALES_SUM_T} > 0 OR m.notes IS NOT NULL
    `);
    backed = r.rowCount || 0;
  } catch (e) {
    console.error('백업 실패 (차감은 계속 진행):', e);
  }

  // 2) 차감 (판매합계 > 재고면 마이너스 허용) + J~Q 초기화
  const r2 = await sql.query(`
    UPDATE tires SET
      qty = qty - ${SALES_SUM},
      mount = 0, direct = 0, daily_del = 0, ping_del = 0,
      ping_dir = 0, store11 = 0, storefarm = 0, lotte = 0,
      updated_at = now()
    WHERE ${SALES_SUM} > 0
  `);

  // 3) 메모도 초기화 (이미 특이사항으로 백업됨)
  let memoCleared = 0;
  try {
    const r3 = await sql.query(`DELETE FROM ship_memo`);
    memoCleared = r3.rowCount || 0;
  } catch (e) {
    console.error('메모 초기화 실패:', e);
  }

  return { ok: true, backed, reset: r2.rowCount || 0, memoCleared };
}

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 시크릿 미설정 시 통과 (설정 권장)
  // 1) Vercel Cron 등: Authorization: Bearer <키>
  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;
  // 2) 외부 스케줄러(cron-job.org 등): URL 뒤에 ?key=<키>
  try {
    const key = new URL(req.url).searchParams.get('key') || '';
    if (key === secret) return true;
  } catch (e) {}
  return false;
}

// Vercel Cron 은 GET 으로 호출
export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ ok: false, msg: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await runReset());
  } catch (e) {
    return NextResponse.json({ ok: false, msg: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  return GET(req);
}
