CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content TEXT NOT NULL,
  mood VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notes_mood_chk
    CHECK (mood IS NULL OR mood IN ('positive', 'neutral', 'challenging'))
);

CREATE INDEX IF NOT EXISTS idx_notes_patient_recorded
  ON notes(patient_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_psychologist_recorded
  ON notes(psychologist_id, recorded_at DESC);
