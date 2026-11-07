// One-off data copy: Postgres (Render) -> MariaDB/MySQL (Plesk).
// Usage:
//   SOURCE_DATABASE_URL=postgres://...  DATABASE_URL=mysql://user:pass@host:3306/db  node scripts/migrate-pg-to-mysql.js
// Creates the MySQL schema if needed, refuses to run if the target already has data
// (pass --force to copy anyway; existing rows with the same id are skipped), and copies
// every table in foreign-key order, preserving ids and created_at timestamps.
const { Pool, types } = require('pg');
const { createMysqlStore } = require('../server/mysql');

types.setTypeParser(1082, v => v); // DATE -> 'YYYY-MM-DD' string, no timezone shifting

const SRC = process.env.SOURCE_DATABASE_URL;
const DST = process.env.DATABASE_URL;
const FORCE = process.argv.includes('--force');

const TABLES = ['purposes', 'community_enterprises', 'users', 'plots', 'trees', 'community_enterprise_members'];

async function main() {
  if (!SRC || !DST || !DST.startsWith('mysql://')) {
    console.error('Set SOURCE_DATABASE_URL (postgres) and DATABASE_URL (mysql://...)');
    process.exit(1);
  }
  const pg = new Pool({ connectionString: SRC, ssl: SRC.includes('localhost') ? false : { rejectUnauthorized: false } });
  const store = createMysqlStore(DST);
  const my = store.pool;
  await store.initSchema();

  if (!FORCE) {
    for (const t of TABLES) {
      const [[{ c }]] = await my.query(`SELECT COUNT(*) AS c FROM ${t}`);
      if (Number(c) > 0) {
        console.error(`Target table ${t} already has ${c} rows. Re-run with --force to merge (duplicates skipped).`);
        process.exit(1);
      }
    }
  }

  const conn = await my.getConnection();
  try {
    await conn.beginTransaction();
    for (const t of TABLES) {
      const [myCols] = await conn.query(`SHOW COLUMNS FROM ${t}`);
      const allowed = new Set(myCols.map(c => c.Field));
      const { rows } = await pg.query(`SELECT * FROM ${t}`);
      let copied = 0;
      for (const row of rows) {
        const cols = Object.keys(row).filter(k => allowed.has(k));
        const vals = cols.map(k => {
          const v = row[k];
          if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v); // JSONB
          return v;
        });
        const [res] = await conn.query(
          `INSERT IGNORE INTO ${t} (${cols.map(c => '`' + c + '`').join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          vals
        );
        copied += res.affectedRows;
      }
      console.log(`${t}: ${copied}/${rows.length} rows copied`);
    }
    await conn.commit();
    console.log('Done.');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await my.end();
    await pg.end();
  }
}

main();
