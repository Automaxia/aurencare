CREATE TABLE IF NOT EXISTS charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  description VARCHAR(255),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT charges_status_chk
    CHECK (status IN ('pending', 'paid', 'canceled'))
);

CREATE INDEX IF NOT EXISTS idx_charges_psychologist_due
  ON charges(psychologist_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_charges_patient ON charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status);
