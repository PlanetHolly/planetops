const express = require('express');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));

// Allow requests from GitHub Pages, local file://, and any device on the floor
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Auth ──────────────────────────────────────────────────────────────────────

const API_KEY = process.env.STATE_API_KEY;

function requireApiKey(req, res, next) {
  if (!API_KEY) {
    console.error('STATE_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'Server misconfigured — STATE_API_KEY not set' });
  }
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Database ──────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Create the state table on startup if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS planetops_state (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`).then(() => {
  console.log('Database ready');
}).catch(err => {
  console.error('Database init failed:', err.message);
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — no auth required, used by Railway to confirm the service is up
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Load state
app.get('/api/state', requireApiKey, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT data FROM planetops_state WHERE id = 'planetops'"
    );
    if (result.rows.length === 0) {
      return res.json(null); // No state yet — app will use defaults
    }
    res.json(result.rows[0].data);
  } catch (err) {
    console.error('GET /api/state failed:', err.message);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

// Save state
app.post('/api/state', requireApiKey, async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    await pool.query(`
      INSERT INTO planetops_state (id, data, updated_at)
      VALUES ('planetops', $1, NOW())
      ON CONFLICT (id) DO UPDATE
        SET data       = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
    `, [data]);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/state failed:', err.message);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// ── Keyed state (ADDITIVE — lets sub-apps like the Gauge keep their own blob) ──
// Existing /api/state (id='planetops') is untouched; this adds id=:key stores.
const KEY_RE = /^[a-z0-9_]{1,40}$/i;

app.get('/api/state/:key', requireApiKey, async (req, res) => {
  if (!KEY_RE.test(req.params.key)) return res.status(400).json({ error: 'Bad key' });
  try {
    const r = await pool.query('SELECT data FROM planetops_state WHERE id = $1', [req.params.key]);
    res.json(r.rows.length ? r.rows[0].data : null);
  } catch (err) {
    console.error('GET /api/state/:key failed:', err.message);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

app.post('/api/state/:key', requireApiKey, async (req, res) => {
  if (!KEY_RE.test(req.params.key)) return res.status(400).json({ error: 'Bad key' });
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Body must be a JSON object' });
  try {
    await pool.query(
      `INSERT INTO planetops_state (id, data, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [req.params.key, data]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/state/:key failed:', err.message);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`PlanetOps State API listening on port ${PORT}`);
});
