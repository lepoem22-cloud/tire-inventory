import { createPool } from '@vercel/postgres';

// Vercel 연동 방식에 따라 변수 이름이 다름 → 전부 시도
function findConnectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  );
}

let _pool = null;
function pool() {
  if (!_pool) {
    const cs = findConnectionString();
    if (!cs) {
      throw new Error(
        'DB 연결 문자열을 찾을 수 없습니다. Vercel 프로젝트 → Storage 탭에서 Postgres(Neon)를 Connect 한 뒤 Redeploy 하세요.'
      );
    }
    _pool = createPool({ connectionString: cs });
  }
  return _pool;
}

// sql`...` (태그드 템플릿) + sql.query(text, params) 둘 다 지원
export const sql = (strings, ...values) => pool().sql(strings, ...values);
sql.query = (text, params) => pool().query(text, params);

let _ready = false;

export async function ensureSchema() {
  if (_ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS tires (
      id            SERIAL PRIMARY KEY,
      brand         TEXT    NOT NULL DEFAULT '',
      pattern       TEXT    NOT NULL DEFAULT '',
      pcode         TEXT    NOT NULL DEFAULT '',
      size          TEXT    NOT NULL DEFAULT '',
      pr            TEXT    NOT NULL DEFAULT '',
      dot           TEXT    NOT NULL DEFAULT '',
      factory       INTEGER NOT NULL DEFAULT 0,
      qty           INTEGER NOT NULL DEFAULT 0,
      mount         INTEGER NOT NULL DEFAULT 0,
      direct        INTEGER NOT NULL DEFAULT 0,
      daily_del     INTEGER NOT NULL DEFAULT 0,
      ping_del      INTEGER NOT NULL DEFAULT 0,
      ping_dir      INTEGER NOT NULL DEFAULT 0,
      store11       INTEGER NOT NULL DEFAULT 0,
      storefarm     INTEGER NOT NULL DEFAULT 0,
      lotte         INTEGER NOT NULL DEFAULT 0,
      dc_rate       DOUBLE PRECISION NOT NULL DEFAULT 0,
      dc_price      INTEGER NOT NULL DEFAULT 0,
      tire_id       TEXT    NOT NULL DEFAULT '',
      product_code  TEXT    NOT NULL DEFAULT '',
      note          TEXT    NOT NULL DEFAULT '',
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS backup_log (
      id            SERIAL PRIMARY KEY,
      ymd           TEXT NOT NULL,
      hm            TEXT NOT NULL,
      tire_pk       INTEGER,
      brand         TEXT, pattern TEXT, pcode TEXT, size TEXT, pr TEXT, dot TEXT,
      factory       INTEGER, qty INTEGER,
      mount         INTEGER, direct INTEGER, daily_del INTEGER,
      ping_del      INTEGER, ping_dir INTEGER, store11 INTEGER,
      storefarm     INTEGER, lotte INTEGER,
      tire_id       TEXT,
      sales_total   INTEGER,
      new_qty       INTEGER,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  _ready = true;
}
