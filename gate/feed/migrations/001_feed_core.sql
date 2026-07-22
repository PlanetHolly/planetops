CREATE TABLE IF NOT EXISTS feed_intake (
  id BIGSERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL UNIQUE,
  declared_category TEXT NOT NULL,
  submitter_name TEXT,
  session_id TEXT,
  ip TEXT,
  filename TEXT,
  mime TEXT,
  note TEXT,
  enc_raw BYTEA,
  status TEXT NOT NULL DEFAULT 'received',
  worker_id TEXT,
  locked_until TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feed_intake_attempt_count_nonnegative CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS feed_intake_status_locked_until_idx
  ON feed_intake (status, locked_until);

CREATE TABLE IF NOT EXISTS feed_outbox (
  id BIGSERIAL PRIMARY KEY,
  intake_id BIGINT NOT NULL REFERENCES feed_intake(id),
  destination TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feed_outbox_state_check CHECK (state IN ('pending', 'sent', 'acked', 'failed')),
  CONSTRAINT feed_outbox_attempts_nonnegative CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS feed_outbox_state_created_at_idx
  ON feed_outbox (state, created_at);

CREATE INDEX IF NOT EXISTS feed_outbox_intake_id_idx
  ON feed_outbox (intake_id);

CREATE TABLE IF NOT EXISTS feed_ledger (
  id BIGSERIAL PRIMARY KEY,
  intake_id BIGINT REFERENCES feed_intake(id),
  correlation_id TEXT,
  content_hash TEXT,
  semantic_key TEXT,
  declared_category TEXT,
  detected_category TEXT,
  registry_commit TEXT,
  extractor_version TEXT,
  model TEXT,
  token_usage JSONB,
  validator_results JSONB,
  decision JSONB,
  destination_outcomes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feed_ledger_intake_id_idx
  ON feed_ledger (intake_id);

CREATE INDEX IF NOT EXISTS feed_ledger_semantic_key_idx
  ON feed_ledger (semantic_key);

CREATE TABLE IF NOT EXISTS feed_incoming (
  fact_id TEXT PRIMARY KEY,
  vendor TEXT,
  job TEXT,
  customer TEXT,
  summary TEXT,
  total NUMERIC,
  line_count INT,
  eta TIMESTAMPTZ,
  status TEXT,
  received_at TIMESTAMPTZ,
  doc_refs JSONB
);

CREATE INDEX IF NOT EXISTS feed_incoming_eta_idx
  ON feed_incoming (eta);

CREATE TABLE IF NOT EXISTS feed_review (
  id BIGSERIAL PRIMARY KEY,
  intake_id BIGINT REFERENCES feed_intake(id),
  reason TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS feed_review_intake_id_idx
  ON feed_review (intake_id);

CREATE TABLE IF NOT EXISTS feed_expense_hold (
  id BIGSERIAL PRIMARY KEY,
  intake_id BIGINT REFERENCES feed_intake(id),
  vendor TEXT,
  total NUMERIC,
  period TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feed_expense_hold_intake_id_idx
  ON feed_expense_hold (intake_id);

CREATE TABLE IF NOT EXISTS feed_vendors (
  normalized_name TEXT PRIMARY KEY,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feed_vendors_status_check CHECK (status IN ('known', 'pending'))
);

CREATE TABLE IF NOT EXISTS feed_graduation (
  doc_type TEXT PRIMARY KEY,
  external_writes_enabled BOOLEAN NOT NULL DEFAULT false,
  docs_seen INT NOT NULL DEFAULT 0,
  misroutes INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feed_graduation_docs_seen_nonnegative CHECK (docs_seen >= 0),
  CONSTRAINT feed_graduation_misroutes_nonnegative CHECK (misroutes >= 0)
);
