-- BSC-068/069: bounded Vietnam-date ranges are converted to UTC before querying.
-- Keep EXCLUDE/booking-history constraints and existing migrations unchanged.
CREATE INDEX idx_bookings_start ON bookings (lower(during));
CREATE INDEX idx_payments_collected_at ON payments (paid_at)
  WHERE status IN ('completed','refunded') AND paid_at IS NOT NULL;
CREATE INDEX idx_payments_refunded_at ON payments (refunded_at)
  WHERE status = 'refunded' AND refund_amount IS NOT NULL AND refunded_at IS NOT NULL;
