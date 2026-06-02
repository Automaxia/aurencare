-- ──────────────────────────────────────────────────────────────────────────
-- Timestamp de quando o pagamento foi efetivado (webhook Pagar.me order.paid).
-- Substitui a aproximação "data da sessão = data do pagamento" usada como
-- fallback na previsão de liquidação (financeiro.prevLiquidacao).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ;

-- Index pra previsão de liquidação e queries financeiras
CREATE INDEX IF NOT EXISTS sessoes_pago_em
  ON sessoes(pago_em)
  WHERE pago_em IS NOT NULL;
