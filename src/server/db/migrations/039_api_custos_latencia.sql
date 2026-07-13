-- Latência por chamada de IA, para p50/p95 (ex.: confirmar que ia.tom ao vivo
-- não trava na cara do psicólogo). Aditiva, nullable — histórico fica sem.
ALTER TABLE api_custos
  ADD COLUMN IF NOT EXISTS latencia_ms INTEGER;

-- Índice parcial pro cálculo de percentis por operação (só linhas com latência).
CREATE INDEX IF NOT EXISTS idx_api_custos_latencia
  ON api_custos (operacao, latencia_ms)
  WHERE latencia_ms IS NOT NULL;
