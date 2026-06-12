import { sql } from '@vercel/postgres';

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

export { sql };
