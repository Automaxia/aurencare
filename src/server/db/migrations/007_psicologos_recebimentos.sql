-- ──────────────────────────────────────────────────────────────────────────
-- Onboarding de Recebimentos (Pagar.me Recipient) — wizard pós-cadastro.
-- §10 + decisão de produto: subconta por psicóloga, split direto.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  -- Tipo de pessoa: 'PF' ou 'PJ'
  ADD COLUMN IF NOT EXISTS pgm_tipo_pessoa         VARCHAR(2),
  -- Documento (CPF ou CNPJ) — criptografado AES-256-GCM em repouso (§14)
  ADD COLUMN IF NOT EXISTS pgm_documento           TEXT,
  -- Razão social (PJ) ou nome civil (PF, default = nome do psicólogo)
  ADD COLUMN IF NOT EXISTS pgm_razao_social        VARCHAR(255),
  -- Data de nascimento (PF) ou de fundação (PJ)
  ADD COLUMN IF NOT EXISTS pgm_data_nascimento     DATE,
  -- Renda/faturamento mensal estimado em centavos — exigido pra KYC
  ADD COLUMN IF NOT EXISTS pgm_renda_centavos      BIGINT,

  -- ── Conta bancária pra repasse ─────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS pgm_banco_codigo        VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pgm_banco_agencia       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pgm_banco_agencia_dv    VARCHAR(2),
  ADD COLUMN IF NOT EXISTS pgm_banco_conta         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pgm_banco_conta_dv      VARCHAR(2),
  -- 'corrente' | 'poupanca'
  ADD COLUMN IF NOT EXISTS pgm_banco_tipo          VARCHAR(20),
  -- Titular (default = mesmo da psicóloga; pode ser diferente em PJ ou conta conjunta)
  ADD COLUMN IF NOT EXISTS pgm_titular_nome        VARCHAR(255),
  -- Documento do titular — criptografado também
  ADD COLUMN IF NOT EXISTS pgm_titular_documento   TEXT,

  -- ── Estado do onboarding ───────────────────────────────────────────────
  -- Quando a psicóloga concluiu o wizard e gerou o recipient na Pagar.me.
  -- NULL = ainda não concluído (soft block ativo).
  ADD COLUMN IF NOT EXISTS pgm_onboarding_em       TIMESTAMPTZ;

-- Index para checagem rápida de "onboarding completo?" no middleware/guards.
CREATE INDEX IF NOT EXISTS psicologos_pgm_onboarding
  ON psicologos(pgm_onboarding_em)
  WHERE pgm_onboarding_em IS NOT NULL;
