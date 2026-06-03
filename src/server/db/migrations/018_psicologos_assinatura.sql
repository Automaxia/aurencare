-- ──────────────────────────────────────────────────────────────────────────
-- Assinatura / planos (modelo freemium pago) §Pricing.
--
-- Planos (caps definidos em código, NÃO no banco — config de negócio):
--   free      — 3 sessões-IA/mês  · R$ 0
--   essencial — 30 sessões-IA/mês · R$ 69,90
--   pro       — 80 sessões-IA/mês · R$ 159,90
--
-- plano_status:
--   ativo        — plano vigente (free sempre 'ativo'; pago = cobrança em dia).
--   inadimplente — cobrança recorrente falhou (Pagar.me payment_failed);
--                  mantém acesso até plano_expira_em, depois cai p/ free.
--   cancelado    — psicólogo cancelou; acesso até o fim do ciclo pago.
--
-- plano_ciclo: 'mensal' | 'anual' (NULL no free).
-- pagarme_subscription_id: id da assinatura recorrente na Pagar.me (cartão).
-- plano_expira_em: fim do período pago vigente (grace/cancelamento).
--
-- Sem coluna de "limite": o cap vem do código por `plano`, então mudar
-- preço/limite não exige migration.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS plano                    VARCHAR(20)  NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plano_status             VARCHAR(20)  NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS plano_ciclo              VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pagarme_subscription_id  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS plano_expira_em          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano_atualizado_em      TIMESTAMPTZ  DEFAULT NOW();

-- ── Uso mensal de sessões-IA (contador por competência) ────────────────────
-- Uma linha por psicólogo × mês de referência (fuso America/Sao_Paulo).
-- Incrementa ao iniciar o Modo Presença (sessão com transcrição/IA).
-- O gate compara `sessoes_ia` com o cap do plano antes de liberar.
CREATE TABLE IF NOT EXISTS uso_mensal (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id  UUID NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
  competencia   CHAR(7) NOT NULL,                 -- 'YYYY-MM'
  sessoes_ia    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (psicologo_id, competencia)
);

CREATE INDEX IF NOT EXISTS uso_mensal_psicologo
  ON uso_mensal(psicologo_id, competencia);

-- Flag idempotente: marca se a sessão já consumiu 1 da cota de sessões-IA.
-- Contabiliza no 1º "Iniciar registro" (Modo Presença); pausar/retomar não recota.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS ia_contabilizada BOOLEAN NOT NULL DEFAULT FALSE;

-- Assinaturas vigentes (para o webhook localizar o psicólogo pelo subscription_id).
CREATE INDEX IF NOT EXISTS psicologos_subscription
  ON psicologos(pagarme_subscription_id)
  WHERE pagarme_subscription_id IS NOT NULL;
