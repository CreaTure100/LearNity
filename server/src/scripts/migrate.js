require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function run() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, executed_at timestamptz NOT NULL DEFAULT now())');

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const already = await client.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [file]);
      if (already.rowCount) {
        console.log(`skip ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`run ${file}`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename) VALUES($1)', [file]);
    }

    await client.query('COMMIT');
    console.log('Миграции успешно выполнены');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка миграций:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    db.pool.end();
  }
}

run();
