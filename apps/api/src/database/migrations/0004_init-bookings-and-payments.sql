CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'online'
    CHECK (source IN ('online', 'manual')),
  guest_name TEXT,
  guest_phone TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  during TSTZRANGE NOT NULL,
  status TEXT NOT NULL DEFAULT 'held'
    CHECK (
      status IN (
        'held',
        'pending_payment',
        'confirmed',
        'completed',
        'cancelled',
        'expired',
        'no_show'
      )
    ),
  total_price INT NOT NULL CHECK (total_price >= 0),
  deposit_amount INT NOT NULL CHECK (deposit_amount >= 0),
  note TEXT,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reminders_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (customer_id IS NOT NULL OR guest_name IS NOT NULL)
);

CREATE INDEX idx_bookings_court_during
  ON bookings USING gist (court_id, during);
CREATE INDEX idx_bookings_customer ON bookings (customer_id);
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_bookings_expires
  ON bookings (expires_at) WHERE status = 'held';
CREATE INDEX idx_bookings_pending
  ON bookings (court_id) WHERE status = 'pending_payment';

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  amount INT NOT NULL CHECK (amount >= 0),
  provider TEXT NOT NULL DEFAULT 'bank_transfer'
    CHECK (provider IN ('bank_transfer', 'cash')),
  transfer_code TEXT,
  proof_url TEXT,
  proof_uploaded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'submitted',
        'completed',
        'rejected',
        'refunded',
        'cancelled',
        'expired'
      )
    ),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  refund_amount INT CHECK (refund_amount IS NULL OR refund_amount >= 0),
  refunded_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payments_transfer_code
    CHECK (provider = 'cash' OR transfer_code IS NOT NULL)
);

CREATE UNIQUE INDEX idx_payments_transfer_code
  ON payments (transfer_code) WHERE transfer_code IS NOT NULL;
CREATE INDEX idx_payments_booking ON payments (booking_id);
CREATE INDEX idx_payments_pending_proof
  ON payments (proof_uploaded_at) WHERE status = 'submitted';
CREATE UNIQUE INDEX uq_payments_active
  ON payments (booking_id)
  WHERE status IN ('pending', 'submitted', 'completed');
