-- Build #4a: extraction working-state columns + daily token budget.
-- All columns nullable — rows created by Build #3 remain valid.

ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS extracted JSONB;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS extractor_model TEXT;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS extractor_version TEXT;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS doc_type TEXT;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS confidence NUMERIC;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS token_usage JSONB;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE TABLE IF NOT EXISTS feed_token_budget (
  day DATE PRIMARY KEY,
  tokens_used BIGINT NOT NULL DEFAULT 0
);
