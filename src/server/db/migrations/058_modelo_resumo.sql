-- ──────────────────────────────────────────────────────────────────────────
-- Modelo de resumo personalizado (recurso do plano Pro, nov/2026).
--
-- Cada psicólogo descreve como quer o registro da sessão (seções, extensão,
-- estilo). NULL = modelo padrão da Audere (6 campos). Só vale com plano Pro
-- efetivo — quem cai de plano mantém o texto salvo, mas volta ao padrão até
-- reassinar o Pro. As regras de CFP do prompt prevalecem sobre o modelo.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS modelo_resumo               TEXT,
  ADD COLUMN IF NOT EXISTS modelo_resumo_atualizado_em TIMESTAMPTZ;
