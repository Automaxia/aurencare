CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (psychologist_id, name)
);

CREATE INDEX IF NOT EXISTS idx_themes_psychologist ON themes(psychologist_id);

CREATE TABLE IF NOT EXISTS note_themes (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (note_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_note_themes_theme ON note_themes(theme_id);
