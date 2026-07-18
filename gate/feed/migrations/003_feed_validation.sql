-- Build #4b: validation working-state columns on feed_intake.
-- Both nullable — rows created by Builds #3/#4a remain valid.
-- (feed_ledger already carries semantic_key/validator_results from 001.)

ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS semantic_key TEXT;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS validator_results JSONB;

CREATE INDEX IF NOT EXISTS feed_intake_semantic_key_idx
  ON feed_intake (semantic_key);
