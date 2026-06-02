-- ──────────────────────────────────────────────────────────────────────────
-- Lista de espera do lançamento. Captura de leads em /lancamento.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lista_espera (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  crp         VARCHAR(30),
  mensagem    TEXT,
  origem      VARCHAR(60) DEFAULT 'lancamento',
  ip          VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lista_espera_created ON lista_espera(created_at DESC);
