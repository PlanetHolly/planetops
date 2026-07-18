-- Build #5b: add 'held' to the feed_outbox state machine.
-- 'held' = shadow — an EXTERNAL row whose doc_type has NOT graduated
-- (feed_graduation.external_writes_enabled). Held rows are released back to
-- 'pending' by the sink's release step once Holly graduates the doc_type.
-- Runs in a transaction under the migrations advisory lock (migrate.js).

ALTER TABLE feed_outbox DROP CONSTRAINT IF EXISTS feed_outbox_state_check;
ALTER TABLE feed_outbox ADD CONSTRAINT feed_outbox_state_check
  CHECK (state IN ('pending', 'sent', 'acked', 'failed', 'held'));
