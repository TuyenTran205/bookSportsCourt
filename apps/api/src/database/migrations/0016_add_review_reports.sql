ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS report_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS report_reason TEXT,
  ADD COLUMN IF NOT EXISTS report_image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_report_status ON reviews(report_status)
  WHERE report_status <> 'none';
