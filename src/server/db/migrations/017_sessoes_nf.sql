-- ──────────────────────────────────────────────────────────────────────────
-- Controle de Nota Fiscal por sessão.
--
-- nf_status:
--   NULL/'pendente' — paga, mas ainda não foi emitida (default p/ pagas).
--   'emitida'       — psicólogo marcou como emitida (com ou sem número).
--   'dispensada'    — não há obrigação de emissão neste caso.
--
-- nf_numero: número exibido pelo prefeitura/Receita Saúde (texto livre).
-- nf_emitida_em: timestamp da marcação.
--
-- Os cálculos de "valor médio sem NF" usam esses campos no painel
-- de Visão Contábil (FASE 3) + na exportação CSV pro contador (FASE 4).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS nf_status      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS nf_numero      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS nf_emitida_em  TIMESTAMPTZ;

-- Indices pra dashboard "sem NF emitida" e exportações mensais
CREATE INDEX IF NOT EXISTS sessoes_nf_pendente
  ON sessoes(psicologo_id, pago_em)
  WHERE pagamento_status = 'pago'
    AND (nf_status IS NULL OR nf_status = 'pendente');
