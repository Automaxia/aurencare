-- ──────────────────────────────────────────────────────────────────────────
-- Contas admin (equipe) ficam no Pro, sem vencimento.
--
-- A regra de fato está em `obterAssinatura` (src/server/services/
-- assinatura.ts): role = 'admin' vale como 'pro' na leitura, inclusive pra
-- quem for promovido depois. Esta migration só alinha o que está gravado, pra
-- o cockpit não mostrar os admins como Essencial/cortesia.
--
-- Não mexe em quem tem assinatura na Pagar.me (quem manda é o webhook).
-- ──────────────────────────────────────────────────────────────────────────

UPDATE psicologos
   SET plano               = 'pro',
       plano_status        = 'ativo',
       plano_ciclo         = NULL,
       plano_expira_em     = NULL,
       plano_atualizado_em = NOW()
 WHERE role = 'admin'
   AND pagarme_subscription_id IS NULL;
