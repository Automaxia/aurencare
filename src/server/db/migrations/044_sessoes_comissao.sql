-- ──────────────────────────────────────────────────────────────────────────
-- Comissão da plataforma por sessão (split Pagar.me).
--
-- Gravada no ato da cobrança (é o valor que REALMENTE foi para o split, não
-- uma reestimativa): assim o Financeiro mostra o líquido correto do psicólogo
-- mesmo que a % da comissão mude depois, e a receita da plataforma fica
-- auditável por sessão.
--
-- NULL = cobrança criada antes do split existir (ou sem split por falta de
-- recipient). O Financeiro trata NULL como 0.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS comissao_centavos INTEGER;

COMMENT ON COLUMN sessoes.comissao_centavos IS
  'Fatia da plataforma no split da Pagar.me, em centavos. NULL = sem split.';
