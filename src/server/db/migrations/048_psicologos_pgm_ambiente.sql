-- ──────────────────────────────────────────────────────────────────────────
-- Em que AMBIENTE da Pagar.me o recebedor foi criado.
--
-- Recipients são por ambiente: o do sandbox não existe na produção. E os IDs
-- são indistinguíveis — `re_<hash>` nos dois. Sem esta coluna, ao virar a
-- chave para live todos os psicólogos continuariam constando como "recebimento
-- configurado" apontando para IDs inexistentes, e a Pagar.me recusaria a order
-- inteira: o paciente não receberia cobrança nenhuma.
--
-- Mesmo perigo que os `mock_rcp_*` já causaram uma vez.
--
-- Os recebedores que existem hoje foram todos criados em sandbox.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos ADD COLUMN IF NOT EXISTS pgm_ambiente VARCHAR(10);

COMMENT ON COLUMN psicologos.pgm_ambiente IS
  'Ambiente Pagar.me do pagarme_recipient_id: sandbox | live. Recipient de outro ambiente não vale.';

UPDATE psicologos
   SET pgm_ambiente = 'sandbox'
 WHERE pagarme_recipient_id IS NOT NULL
   AND pgm_ambiente IS NULL;
