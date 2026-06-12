import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 출고합계 = J~Q (mount~lotte)
const SALES_SUM = `(mount + direct + daily_del + ping_del + ping_dir + store11 + storefarm + lotte)`;

async function runReset() {
  await ensureSchema();

  // 1) 출고가 있는 행만 백업 (실패해도 차감은 진행)
  let backed = 0;
  try {
    const r = await sql.query(`
      INSERT INTO backup_log
        (ymd, hm, tire_pk, brand, pattern, pcode, size, pr, dot,
         factory, qty, mount, direct, daily_del, ping_del, ping_dir,
         store11, storefarm, lotte, tire_id, sales_total, new_qty)
      SELECT
        to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'),
        to_char(now() AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS'),
        id, brand, pattern, pcode, size, pr, dot,
        factory, qty, mount, direct, daily_del, ping_del, ping_dir,
        store11, storefarm, lotte, tire_id,
        ${SALES_SUM},
        qty - ${SALES_SUM}
      FROM tires
      WHERE ${SALES_SUM} > 0
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

  return { ok: true, backed, reset: r2.rowCount || 0 };
}

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 시크릿 미설정 시 통과 (설정 권장)
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
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
