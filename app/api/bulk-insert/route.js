import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 시트 열 순서(A~S) → 컬럼. 변동(I)은 계산열이라 제외(건너뜀)
// A브랜드 B패턴 C코드 D사이즈 E피수 F DOT G공장가 H수량 [I변동건너뜀] J장착 K직배 L택배 M핑택 N핑직 O11번 P스팜 Q롯데 R할인율 S할인가
const COLS = ['brand','pattern','pcode','size','pr','dot','factory','qty',
  null, // I 변동 (건너뜀)
  'mount','direct','daily_del','ping_del','ping_dir','store11','storefarm','lotte','dc_rate','dc_price'];

const TEXT = new Set(['brand','pattern','pcode','size','pr','dot']);
const INT  = new Set(['factory','qty','mount','direct','daily_del','ping_del','ping_dir','store11','storefarm','lotte','dc_price']);

function toN(v){ const n=Number(String(v??'').replace(/[^0-9.-]/g,'')); return isFinite(n)?Math.trunc(n):0; }
function toF(v){ const n=Number(String(v??'').replace(/[^0-9.-]/g,'')); return isFinite(n)?n:0; }
function toS(v){ return String(v??'').replace(/\s+/g,' ').trim(); }

// 입력 컬럼 (변동 제외, 19개 중 18개)
const FIELDS = COLS.filter(Boolean);

export async function POST(req) {
  try {
    await ensureSchema();
    const me = currentUser();
    if (!me) return NextResponse.json({ ok:false, msg:'로그인이 필요합니다' }, { status:401 });
    if (me.role !== 'admin') return NextResponse.json({ ok:false, msg:'관리자만 가능합니다' }, { status:403 });

    const body = await req.json();
    const rows = Array.isArray(body.rows) ? body.rows : []; // 각 row = 셀 문자열 배열(시트 열 순서)
    const replace = body.replace === true;
    const deleteIds = Array.isArray(body.deleteIds) ? body.deleteIds.map(Number).filter(Boolean) : [];

    if (replace) {
      await sql`TRUNCATE TABLE tires RESTART IDENTITY`;
      try { await sql`TRUNCATE TABLE ship_memo RESTART IDENTITY`; } catch(e){}
    } else if (deleteIds.length) {
      // 지정한 행들만 삭제 후 새로 입력 (표에서 시작 행~끝까지 대체)
      await sql.query(`DELETE FROM tires WHERE id = ANY($1::int[])`, [deleteIds]);
      try { await sql.query(`DELETE FROM ship_memo WHERE tire_pk = ANY($1::int[])`, [deleteIds]); } catch(e){}
    }

    // 각 row를 FIELDS 순서의 값 배열로 변환
    const records = [];
    for (const cells of rows) {
      if (!Array.isArray(cells)) continue;
      const rec = {};
      let colIdx = 0;
      for (let i = 0; i < COLS.length; i++) {
        const col = COLS[i];
        const raw = cells[i];
        if (col === null) continue; // 변동 건너뜀
        if (TEXT.has(col)) rec[col] = toS(raw);
        else if (INT.has(col)) rec[col] = toN(raw);
        else rec[col] = toF(raw); // dc_rate
      }
      // 완전히 빈 줄은 건너뜀
      if (!rec.brand && !rec.pattern && !rec.size) continue;
      records.push(rec);
    }

    if (!records.length) return NextResponse.json({ ok:true, inserted:0 });

    // 청크로 나눠 다중행 INSERT (파라미터 한도 고려: 18컬럼 × 500행 = 9000 < 65535)
    const CHUNK = 500;
    let inserted = 0;
    for (let start = 0; start < records.length; start += CHUNK) {
      const slice = records.slice(start, start + CHUNK);
      const ph = [];
      const flat = [];
      slice.forEach((rec, ri) => {
        const base = ri * FIELDS.length;
        ph.push('(' + FIELDS.map((_, ci) => `$${base + ci + 1}`).join(',') + ')');
        FIELDS.forEach(f => flat.push(rec[f]));
      });
      await sql.query(
        `INSERT INTO tires (${FIELDS.join(',')}) VALUES ${ph.join(',')}`,
        flat
      );
      inserted += slice.length;
    }

    return NextResponse.json({ ok:true, inserted });
  } catch (e) {
    return NextResponse.json({ ok:false, msg:e.message }, { status:500 });
  }
}
