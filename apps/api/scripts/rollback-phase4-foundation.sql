-- DOWN for 0008. Destructive: run only on a disposable DB or after a verified backup.
-- Not consumed by the migration runner. Intentionally not executed against public.
DROP TRIGGER trg_payment_snapshot_immutable ON payments;
DROP FUNCTION protect_payment_snapshot();
ALTER TABLE payments DROP CONSTRAINT chk_payment_snapshot,
  DROP CONSTRAINT chk_payment_proof_order, DROP CONSTRAINT chk_payment_refund_note,
  DROP COLUMN bank_account_snapshot, DROP COLUMN proof_object_key,
  DROP COLUMN proof_updated_at, DROP COLUMN refund_note;
ALTER TABLE owner_applications DROP COLUMN tax_code;
ALTER TABLE users DROP COLUMN session_version;
DROP INDEX uq_notifications_event_user;
ALTER TABLE notifications DROP COLUMN event_key;
DROP TABLE storage_cleanup_jobs;
DROP TABLE outbox_deliveries;
DROP TABLE oauth_states;
ALTER TABLE venues ALTER COLUMN rating_avg TYPE NUMERIC(2,1);
CREATE OR REPLACE FUNCTION refresh_venue_rating() RETURNS TRIGGER AS $$
DECLARE v_id UUID := COALESCE(NEW.venue_id, OLD.venue_id);
BEGIN
  UPDATE venues SET
    rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric,1) FROM reviews WHERE venue_id=v_id AND is_visible=true),0),
    review_count = (SELECT COUNT(*) FROM reviews WHERE venue_id=v_id AND is_visible=true)
  WHERE id=v_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DELETE FROM schema_migrations WHERE filename='0008_phase4-foundation.sql';
