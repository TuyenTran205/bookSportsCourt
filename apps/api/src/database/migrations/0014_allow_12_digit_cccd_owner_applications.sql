ALTER TABLE owner_applications
  DROP CONSTRAINT IF EXISTS chk_owner_app_tax_code;

ALTER TABLE owner_applications
  ADD CONSTRAINT chk_owner_app_tax_code
  CHECK (tax_code IS NULL OR tax_code ~ '^([0-9]{10}|[0-9]{12}|[0-9]{13})$');
