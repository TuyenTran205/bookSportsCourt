-- Preserve the exact provider request across retries (private, never exposed by API).
ALTER TABLE outbox_deliveries
  ADD COLUMN email_request JSONB,
  ADD COLUMN first_attempt_at TIMESTAMPTZ,
  ADD CONSTRAINT outbox_email_request_object CHECK (
    email_request IS NULL OR (channel = 'email' AND jsonb_typeof(email_request) = 'object')
  );
CREATE INDEX idx_outbox_email_lease ON outbox_deliveries(lease_expires_at)
  WHERE channel = 'email' AND status = 'processing';
