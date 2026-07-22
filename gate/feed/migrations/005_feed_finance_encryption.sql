-- Round 2: encrypted storage for extracted finance facts and review payloads.
-- Additive/idempotent only. This system has never run in production, so there
-- are no production rows to migrate or re-encrypt.
-- Runs in a transaction under the migrations advisory lock (migrate.js).

ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS extracted_enc BYTEA;
ALTER TABLE feed_intake ADD COLUMN IF NOT EXISTS finance_unlocked_at_upload BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE feed_review ADD COLUMN IF NOT EXISTS payload_enc BYTEA;
