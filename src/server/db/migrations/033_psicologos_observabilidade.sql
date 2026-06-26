-- ──────────────────────────────────────────────────────────────────────────
-- Observabilidade de uso dos psicólogos (beta): quem está logando e usando.
-- Contadores denormalizados em psicologos (lista rápida) + tabela de eventos
-- (histórico/auditoria, 1 linha por login).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS ultimo_login_em  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_count      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_acesso_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS login_eventos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id UUID NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
  em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip           VARCHAR(45),
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS login_eventos_psi_em ON login_eventos(psicologo_id, em DESC);
