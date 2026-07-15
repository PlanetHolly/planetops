const express = require('express');
const fs = require('fs');
const path = require('path');

const STATUSES = ['Submitted', 'Working', 'Revision Requested', 'Complete'];
const MAX_PROOF_BYTES = 6 * 1024 * 1024;
const MAX_TEMPLATE_BYTES = 4 * 1024 * 1024;
const TEMPLATE_PRODUCTS = new Set(['bandana', 'tee', 'paisley']);
const STATIC_MANIFEST_PATH = path.resolve(__dirname, '..', 'graphics', 'assets', 'manifest.json');

function cleanText(v, max = 500) {
  return String(v || '').trim().slice(0, max);
}

function decodeProof(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/(jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw Object.assign(new Error('proof must be JPEG or WebP data URL'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_PROOF_BYTES) throw Object.assign(new Error('proof image is too large'), { status: 413 });
  return buf;
}

function decodeTemplateImage(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/(png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw Object.assign(new Error('template image must be PNG or WebP data URL'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_TEMPLATE_BYTES) throw Object.assign(new Error('template image is too large'), { status: 413 });
  return { buf, mime: m[1] === 'png' ? 'image/png' : 'image/webp' };
}

function proofMime(buf) {
  if (buf?.[0] === 0xff && buf?.[1] === 0xd8) return 'image/jpeg';
  if (buf?.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

function readStaticManifest() {
  return JSON.parse(fs.readFileSync(STATIC_MANIFEST_PATH, 'utf8'));
}

function jsonArray(value, name) {
  if (!Array.isArray(value) || value.length !== 4 || value.some(v => !Number.isFinite(Number(v)))) {
    throw Object.assign(new Error(`${name} must be a four-number array`), { status: 400 });
  }
  return value.map(v => Math.round(Number(v)));
}

function publicTemplateRow(row) {
  return {
    id: row.id,
    product: row.product,
    slug: row.slug,
    label: row.label,
    pantone: row.pantone,
    flat: row.flat,
    src: `/api/graphics/template-img/${encodeURIComponent(row.product)}/${encodeURIComponent(row.slug)}`,
    width: row.width,
    height: row.height,
    fabricBounds: row.fabric_bounds,
    imprintZone: row.imprint_zone,
    zoneMode: row.product === 'paisley' ? 'paisley-center' : row.product === 'tee' ? 'fixed-fraction-tee' : 'uploaded-fabric-bounds',
    dbBacked: true,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

module.exports = function graphicsRouter(pool, requireSession) {
  const router = express.Router();

  pool.query(`
    CREATE TABLE IF NOT EXISTS graphics_orders (
      id SERIAL PRIMARY KEY,
      order_no TEXT,
      title TEXT,
      status TEXT,
      customer TEXT,
      product TEXT,
      intake JSONB,
      notes JSONB DEFAULT '[]',
      proof_img BYTEA,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).then(() => console.log('graphics_orders ready'))
    .catch(err => console.error('graphics_orders init failed:', err.message));

  pool.query(`
    CREATE TABLE IF NOT EXISTS graphics_templates (
      id SERIAL PRIMARY KEY,
      product TEXT NOT NULL,
      slug TEXT NOT NULL,
      label TEXT,
      pantone TEXT,
      flat BOOLEAN DEFAULT false,
      mime TEXT,
      image BYTEA,
      width INT,
      height INT,
      fabric_bounds JSONB,
      imprint_zone JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (product, slug)
    )
  `).then(() => console.log('graphics_templates ready'))
    .catch(err => console.error('graphics_templates init failed:', err.message));

  router.get(/^\/graphics\/.*\.md$/i, (req, res) => res.status(404).send('Not found'));

  router.get('/api/graphics/templates', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const manifest = readStaticManifest();
      manifest.products = manifest.products || {};
      const r = await pool.query(`
        SELECT id, product, slug, label, pantone, flat, width, height,
               fabric_bounds, imprint_zone, created_at, updated_at
        FROM graphics_templates
        ORDER BY product, slug
      `);
      for (const row of r.rows) {
        if (!manifest.products[row.product]) manifest.products[row.product] = [];
        const entry = publicTemplateRow(row);
        const idx = manifest.products[row.product].findIndex(item => item.slug === row.slug);
        if (idx >= 0) manifest.products[row.product][idx] = { ...manifest.products[row.product][idx], ...entry };
        else manifest.products[row.product].push(entry);
      }
      res.set('Cache-Control', 'no-store, private').json(manifest);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/api/graphics/template-img/:product/:slug', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const r = await pool.query(
        'SELECT image, mime FROM graphics_templates WHERE product=$1 AND slug=$2',
        [req.params.product, req.params.slug]
      );
      if (!r.rows[0] || !r.rows[0].image) return res.status(404).send('Not found');
      res.set('Cache-Control', 'no-store, private');
      res.type(r.rows[0].mime || 'application/octet-stream').send(r.rows[0].image);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/api/graphics/templates', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const product = cleanText(req.body.product, 40);
      const slug = cleanText(req.body.slug, 40);
      if (!TEMPLATE_PRODUCTS.has(product)) return res.status(400).json({ error: 'invalid product' });
      if (!/^[a-z0-9-]{1,40}$/.test(slug)) return res.status(400).json({ error: 'invalid slug' });
      const image = decodeTemplateImage(req.body.image);
      const width = Math.max(1, Math.round(Number(req.body.width) || 0));
      const height = Math.max(1, Math.round(Number(req.body.height) || 0));
      const fabricBounds = jsonArray(req.body.fabricBounds, 'fabricBounds');
      const imprintZone = jsonArray(req.body.imprintZone, 'imprintZone');
      if (!width || !height) return res.status(400).json({ error: 'width and height required' });
      const r = await pool.query(`
        INSERT INTO graphics_templates
          (product, slug, label, pantone, flat, mime, image, width, height, fabric_bounds, imprint_zone)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)
        ON CONFLICT (product, slug) DO UPDATE SET
          label=EXCLUDED.label,
          pantone=EXCLUDED.pantone,
          flat=EXCLUDED.flat,
          mime=EXCLUDED.mime,
          image=EXCLUDED.image,
          width=EXCLUDED.width,
          height=EXCLUDED.height,
          fabric_bounds=EXCLUDED.fabric_bounds,
          imprint_zone=EXCLUDED.imprint_zone,
          updated_at=NOW()
        RETURNING id, product, slug, label, pantone, flat, width, height,
                  fabric_bounds, imprint_zone, created_at, updated_at
      `, [
        product,
        slug,
        cleanText(req.body.label, 160) || slug,
        cleanText(req.body.pantone, 120),
        !!req.body.flat,
        image.mime,
        image.buf,
        width,
        height,
        JSON.stringify(fabricBounds),
        JSON.stringify(imprintZone)
      ]);
      res.set('Cache-Control', 'no-store, private').json(publicTemplateRow(r.rows[0]));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  router.delete('/api/graphics/templates/:product/:slug', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      await pool.query('DELETE FROM graphics_templates WHERE product=$1 AND slug=$2', [req.params.product, req.params.slug]);
      res.set('Cache-Control', 'no-store, private').json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/api/graphics/orders', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const r = await pool.query(`
        SELECT id, order_no, title, status, customer, product, intake, notes,
               created_at, started_at, completed_at, updated_at
        FROM graphics_orders
        ORDER BY created_at DESC
        LIMIT 100
      `);
      const counts = { pending: 0, open: 0, completed: 0 };
      for (const row of r.rows) {
        if (row.status === 'Submitted' || row.status === 'Revision Requested') counts.pending++;
        if (row.status !== 'Complete') counts.open++;
        if (row.status === 'Complete') counts.completed++;
      }
      res.set('Cache-Control', 'no-store, private').json({ orders: r.rows, counts });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/api/graphics/orders', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const proof = decodeProof(req.body.proof);
      const title = cleanText(req.body.title, 240);
      if (!title) return res.status(400).json({ error: 'title required' });
      const status = 'Submitted';
      const r = await pool.query(`
        INSERT INTO graphics_orders (order_no, title, status, customer, product, intake, notes, proof_img)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,'[]'::jsonb,$7)
        RETURNING id, order_no, title, status, customer, product, intake, notes,
                  created_at, started_at, completed_at, updated_at
      `, [
        cleanText(req.body.order_no, 80),
        title,
        status,
        cleanText(req.body.customer, 240),
        cleanText(req.body.product, 80),
        JSON.stringify(req.body.intake || {}),
        proof
      ]);
      res.status(201).json({ order: r.rows[0] });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  router.get('/api/graphics/orders/:id', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const r = await pool.query(`
        SELECT id, order_no, title, status, customer, product, intake, notes,
               created_at, started_at, completed_at, updated_at
        FROM graphics_orders
        WHERE id=$1
      `, [req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
      res.set('Cache-Control', 'no-store, private').json(r.rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch('/api/graphics/orders/:id', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const current = await pool.query('SELECT intake, notes, status FROM graphics_orders WHERE id=$1', [req.params.id]);
      if (!current.rows[0]) return res.status(404).json({ error: 'not found' });
      const status = req.body.status ? cleanText(req.body.status, 80) : current.rows[0].status;
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });
      const intake = req.body.intake && typeof req.body.intake === 'object' ? req.body.intake : current.rows[0].intake;
      const notes = Array.isArray(current.rows[0].notes) ? current.rows[0].notes : [];
      if (req.body.note) notes.push({ text: cleanText(req.body.note, 2000), at: new Date().toISOString() });
      const r = await pool.query(`
        UPDATE graphics_orders
        SET status=$2,
            intake=$3::jsonb,
            notes=$4::jsonb,
            started_at=CASE WHEN $2='Working' AND started_at IS NULL THEN NOW() ELSE started_at END,
            completed_at=CASE WHEN $2='Complete' THEN COALESCE(completed_at, NOW()) WHEN $2 <> 'Complete' THEN NULL ELSE completed_at END,
            updated_at=NOW()
        WHERE id=$1
        RETURNING id, order_no, title, status, customer, product, intake, notes,
                  created_at, started_at, completed_at, updated_at
      `, [req.params.id, status, JSON.stringify(intake || {}), JSON.stringify(notes)]);
      res.set('Cache-Control', 'no-store, private').json(r.rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/api/graphics/proof/:id', async (req, res) => {
    if (!await requireSession(req, res)) return;
    try {
      const r = await pool.query('SELECT proof_img FROM graphics_orders WHERE id=$1', [req.params.id]);
      if (!r.rows[0] || !r.rows[0].proof_img) return res.status(404).send('Not found');
      res.set('Cache-Control', 'no-store, private');
      res.type(proofMime(r.rows[0].proof_img)).send(r.rows[0].proof_img);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
