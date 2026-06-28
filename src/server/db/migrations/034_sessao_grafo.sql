-- ──────────────────────────────────────────────────────────────────────────
-- Inteligência Clínica Longitudinal — store por-sessão (fonte da verdade).
-- Snapshot dos nós/arestas extraídos de CADA sessão, versionado. O agregado
-- (palavras_chave/arestas_tema) passa a ser DERIVADO deste store, com a
-- recorrência contada (nº de sessões), não inferida pelo LLM.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessao_grafo (
  id                       BIGSERIAL PRIMARY KEY,
  paciente_id              UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  sessao_id                UUID NOT NULL REFERENCES sessoes(id)   ON DELETE CASCADE,
  sessao_num               INTEGER,
  versao_prompt            VARCHAR(40),
  versao_conceitualizacao  VARCHAR(40),
  nos                      JSONB NOT NULL DEFAULT '[]'::jsonb,
  arestas                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (paciente_id, sessao_id)
);

CREATE INDEX IF NOT EXISTS sessao_grafo_paciente ON sessao_grafo(paciente_id, sessao_num);
