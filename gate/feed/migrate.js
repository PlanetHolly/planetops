const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const ADVISORY_LOCK_KEY = 73420117;

let schemaStatus = 'pending';
let inFlight = null;

function feedSchemaStatus() {
  return schemaStatus;
}

function listMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort();
}

async function ensureMigrationTable(pool) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADVISORY_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS feed_schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function applyMigration(pool, version) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, version), 'utf8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADVISORY_LOCK_KEY]);

    const applied = await client.query(
      'SELECT 1 FROM feed_schema_migrations WHERE version = $1',
      [version]
    );
    if (applied.rowCount === 0) {
      await client.query(sql);
      await client.query(
        'INSERT INTO feed_schema_migrations (version) VALUES ($1)',
        [version]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function runFeedMigrations(pool) {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    schemaStatus = 'pending';
    try {
      await ensureMigrationTable(pool);
      for (const version of listMigrationFiles()) {
        try {
          await applyMigration(pool, version);
        } catch (err) {
          schemaStatus = `FAIL: ${version}: ${err.message}`;
          throw err;
        }
      }
      schemaStatus = 'ok';
    } catch (err) {
      if (!schemaStatus.startsWith('FAIL: ')) {
        schemaStatus = `FAIL: ${err.message}`;
      }
      throw err;
    }
  })();

  return inFlight;
}

module.exports = { runFeedMigrations, feedSchemaStatus };
