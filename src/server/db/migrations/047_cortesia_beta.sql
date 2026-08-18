-- ──────────────────────────────────────────────────────────────────────────
-- Cortesia de 1 ano para as contas do beta.
--
-- Contexto: até ago/2026 o produto rodou com BETA_LIBERADO = true, que
-- desligava a cobrança E o gate de cota. Ao ligar a venda, a flag vira false e
-- o gate passa a valer — como o default da coluna `plano` é 'free' (3 sessões-
-- IA/mês), toda a base beta seria capada em 3 sessões de uma vez, sem nunca ter
-- tido a chance de assinar. Esta migration evita isso: quem já estava dentro
-- ganha o equivalente ao Essencial (30/mês) por um ano.
--
-- MARCADOR DA CORTESIA: `pagarme_subscription_id IS NULL` com plano != 'free'.
-- Quem assinou de verdade sempre tem subscription_id — inclusive no modo mock,
-- que gera um id sintético (`mock_sub_…`). Por isso não é preciso coluna nova,
-- e por isso o WHERE abaixo não pode atingir assinante pagante.
--
-- O vencimento é aplicado em `obterAssinatura` (src/server/services/
-- assinatura.ts): passado `plano_expira_em`, uma conta SEM subscription_id
-- volta a valer como 'free'. Sem isso a data aqui seria decorativa — nada no
-- código rebaixava plano vencido.
--
-- Uma vez só: o runner registra em _migrations, então "contas de hoje" é
-- exatamente a base no instante do deploy. Conta criada depois nasce free.
-- ──────────────────────────────────────────────────────────────────────────

UPDATE psicologos
   SET plano               = 'essencial',
       plano_status        = 'ativo',
       plano_ciclo         = NULL,          -- não é ciclo de cobrança; é cortesia
       plano_expira_em     = NOW() + INTERVAL '1 year',
       plano_atualizado_em = NOW()
 WHERE plano = 'free'
   AND pagarme_subscription_id IS NULL;
