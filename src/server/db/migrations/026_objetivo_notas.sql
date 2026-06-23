-- ──────────────────────────────────────────────────────────────────────────
-- Marcos de progresso da Meta — anotações livres datadas que o psicólogo
-- registra ao longo do acompanhamento. Funciona em QUALQUER método (SMART ou
-- Simples/Livre), independente de métrica numérica ou GAS.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS objetivo_notas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id  UUID NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
  texto        TEXT NOT NULL,
  marco_em     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS obj_notas_objetivo ON objetivo_notas(objetivo_id, marco_em DESC);
