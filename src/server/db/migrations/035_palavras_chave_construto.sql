-- ──────────────────────────────────────────────────────────────────────────
-- Fase 2 da Inteligência Clínica Longitudinal: nó rico no agregado.
-- construto (descrição clínica), contextos (gatilhos acumulados), relevancia
-- (0–1, modo Clínico) e fora_conceitualizacao. Derivados do sessao_grafo; ficam
-- prontos pra leitura no clique (Fase 3), sem custo de LLM.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE palavras_chave
  ADD COLUMN IF NOT EXISTS construto            TEXT,
  ADD COLUMN IF NOT EXISTS contextos            JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS relevancia           NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS fora_conceitualizacao BOOLEAN DEFAULT FALSE;
