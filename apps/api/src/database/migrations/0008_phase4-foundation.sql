-- Additive Phase 4 foundation. Legacy data is intentionally not fabricated.
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0
  CONSTRAINT chk_users_session_version CHECK (session_version >= 0);
ALTER TABLE owner_applications ADD COLUMN tax_code TEXT
  CONSTRAINT chk_owner_app_tax_code CHECK (tax_code IS NULL OR tax_code ~ '^([0-9]{10}|[0-9]{13})$');
ALTER TABLE payments
  ADD COLUMN bank_account_snapshot JSONB,
  ADD COLUMN proof_object_key TEXT,
  ADD COLUMN proof_updated_at TIMESTAMPTZ,
  ADD COLUMN refund_note TEXT,
  ADD CONSTRAINT chk_payment_snapshot CHECK (bank_account_snapshot IS NULL OR COALESCE(
    jsonb_typeof(bank_account_snapshot) = 'object'
    AND jsonb_typeof(bank_account_snapshot->'bankBin') = 'string'
    AND jsonb_typeof(bank_account_snapshot->'accountNo') = 'string'
    AND jsonb_typeof(bank_account_snapshot->'accountName') = 'string'
    AND bank_account_snapshot->>'bankBin' ~ '^[0-9]{6}$'
    AND bank_account_snapshot->>'accountNo' ~ '^[0-9]{6,30}$'
    AND length(btrim(bank_account_snapshot->>'accountName')) BETWEEN 2 AND 200
    AND (bank_account_snapshot - ARRAY['bankBin','accountNo','accountName']) = '{}'::jsonb, false)),
  ADD CONSTRAINT chk_payment_proof_order CHECK (proof_updated_at IS NULL OR
    (proof_uploaded_at IS NOT NULL AND proof_updated_at >= proof_uploaded_at)),
  ADD CONSTRAINT chk_payment_refund_note CHECK (refund_note IS NULL OR length(btrim(refund_note)) BETWEEN 1 AND 1000);

CREATE FUNCTION protect_payment_snapshot() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.bank_account_snapshot IS NOT NULL AND NEW.bank_account_snapshot IS DISTINCT FROM OLD.bank_account_snapshot THEN
    RAISE EXCEPTION 'PAYMENT_SNAPSHOT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_payment_snapshot_immutable BEFORE UPDATE OF bank_account_snapshot ON payments
FOR EACH ROW EXECUTE FUNCTION protect_payment_snapshot();

ALTER TABLE notifications ADD COLUMN event_key TEXT;
CREATE UNIQUE INDEX uq_notifications_event_user ON notifications(event_key,user_id) WHERE event_key IS NOT NULL;

CREATE TABLE oauth_states (
  id UUID PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  binding_hash TEXT NOT NULL,
  nonce_hash TEXT NOT NULL,
  pkce_verifier_ciphertext TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_oauth_state_hashes CHECK (state_hash ~ '^[a-f0-9]{64}$' AND binding_hash ~ '^[a-f0-9]{64}$' AND nonce_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chk_oauth_state_expiry CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes')
);
CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at);

-- One row per event/channel/recipient. Payload contains IDs/allowlisted data only.
CREATE TABLE outbox_deliveries (
  id UUID PRIMARY KEY,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','realtime')),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed','delivery_unknown')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_outbox_delivery UNIQUE(event_key,channel,recipient_id),
  CONSTRAINT chk_outbox_lease CHECK ((status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL)),
  CONSTRAINT chk_outbox_delivered CHECK ((status = 'delivered') = (delivered_at IS NOT NULL))
);
CREATE INDEX idx_outbox_due ON outbox_deliveries(status,next_attempt_at);

CREATE TABLE storage_cleanup_jobs (
  id UUID PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  not_before TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_cleanup_lease CHECK ((status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL))
);
CREATE INDEX idx_storage_cleanup_due ON storage_cleanup_jobs(status,not_before);

ALTER TABLE venues ALTER COLUMN rating_avg TYPE NUMERIC(3,2);
CREATE OR REPLACE FUNCTION refresh_venue_rating() RETURNS TRIGGER AS $$
DECLARE v_id UUID := COALESCE(NEW.venue_id, OLD.venue_id);
BEGIN
  UPDATE venues SET
    rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric,2) FROM reviews WHERE venue_id=v_id AND is_visible=true),0),
    review_count = (SELECT COUNT(*) FROM reviews WHERE venue_id=v_id AND is_visible=true)
  WHERE id=v_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
-- Recompute from real reviews; merely widening the column cannot restore precision.
UPDATE venues v SET
  rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric,2) FROM reviews r WHERE r.venue_id=v.id AND r.is_visible=true),0),
  review_count = (SELECT COUNT(*) FROM reviews r WHERE r.venue_id=v.id AND r.is_visible=true);
