-- ──────────────────────────────────────────────────────────────────────────
-- Custo de APIs externas (Anthropic, AssemblyAI…) — observabilidade de custo
-- pra alimentar o modelo de negócio (custo por sessão/operação).
--
-- Anthropic: PRECISO (tokens reais vindos da resposta da API).
-- AssemblyAI: ESTIMADO (streaming é navegador→AssemblyAI; o servidor não vê os
--   minutos, então estimamos pela duração da sessão). Marcado em `estimado`.
--
-- Rastreia daqui pra frente; o total histórico consolidado fica no console do
-- provedor. Aqui o ganho é o detalhamento que o console não dá.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_custos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        VARCHAR(20) NOT NULL,         -- 'anthropic' | 'assemblyai'
  operacao        VARCHAR(40),                  -- escopo (ex: 'anthropic.resumo')
  modelo          VARCHAR(40),
  psicologo_id    UUID,
  sessao_id       UUID,
  tokens_entrada  BIGINT  NOT NULL DEFAULT 0,
  tokens_saida    BIGINT  NOT NULL DEFAULT 0,
  segundos        INTEGER NOT NULL DEFAULT 0,
  estimado        BOOLEAN NOT NULL DEFAULT FALSE,
  custo_usd       NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_custos_data     ON api_custos(created_at);
CREATE INDEX IF NOT EXISTS idx_api_custos_provider ON api_custos(provider, created_at);
