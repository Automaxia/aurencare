-- ──────────────────────────────────────────────────────────────────────────
-- Gateway de pagamento neutro (Pagar.me + Asaas lado a lado). docs/asaas/sdd.md §3.
--
-- Cada cobrança, recebedor e assinatura passa a registrar EM QUAL gateway foi
-- criada (RF-PG-02). Eventos, estornos e consultas usam sempre o gateway de
-- origem, mesmo depois de trocar o padrão (PAYMENT_GATEWAY).
--
-- As colunas `pagarme_*` continuam existindo e o adaptador Pagar.me continua
-- gravando nelas (dual-write): pod antigo e pod novo convivem durante o
-- rollout sem quebrar. Remoção só na Fase 4.
-- ──────────────────────────────────────────────────────────────────────────

-- sessões: cobrança
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS gateway                  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cobranca_id              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cobranca_parcelamento_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cobranca_qrcode          TEXT,
  ADD COLUMN IF NOT EXISTS cobranca_qrcode_url      TEXT,
  ADD COLUMN IF NOT EXISTS cobranca_url             TEXT,
  ADD COLUMN IF NOT EXISTS cobranca_vence_em        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS taxa_gateway_centavos    INTEGER,
  -- Estorno que o gateway não aceitou agora (Asaas: sem saldo na raiz / "tente
  -- novamente", D-08). pagamento_status continua 'pago'; o cron repete.
  ADD COLUMN IF NOT EXISTS reembolso_pendente_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reembolso_motivo         TEXT;

UPDATE sessoes
   SET gateway = 'pagarme', cobranca_id = pagarme_order_id,
       cobranca_qrcode = pagarme_qrcode, cobranca_qrcode_url = pagarme_qrcode_url,
       cobranca_url = pagarme_checkout_url
 WHERE pagarme_order_id IS NOT NULL AND cobranca_id IS NULL;

CREATE INDEX IF NOT EXISTS sessoes_cobranca
  ON sessoes (gateway, cobranca_id) WHERE cobranca_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessoes_reembolso_pendente
  ON sessoes (reembolso_pendente_em) WHERE reembolso_pendente_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessoes_cobranca_parcelamento
  ON sessoes (gateway, cobranca_parcelamento_id) WHERE cobranca_parcelamento_id IS NOT NULL;

COMMENT ON COLUMN sessoes.gateway IS 'pagarme | asaas — onde a cobrança foi criada (RF-PG-02).';
COMMENT ON COLUMN sessoes.cobranca_id IS 'order (pagarme) | pay_... (asaas; 1ª parcela no parcelado).';
COMMENT ON COLUMN sessoes.taxa_gateway_centavos IS 'valor − líquido real informado pelo gateway no webhook.';

-- psicólogos: recebedor
ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS recebedor_gateway          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recebedor_id               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recebedor_wallet_id        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recebedor_api_key          TEXT,
  ADD COLUMN IF NOT EXISTS recebedor_situacao         VARCHAR(30),
  ADD COLUMN IF NOT EXISTS recebedor_situacao_detalhe JSONB,
  ADD COLUMN IF NOT EXISTS recebedor_ambiente         VARCHAR(10);

UPDATE psicologos
   SET recebedor_gateway = 'pagarme', recebedor_id = pagarme_recipient_id,
       recebedor_ambiente = COALESCE(pgm_ambiente, 'sandbox')
 WHERE pagarme_recipient_id IS NOT NULL
   AND pagarme_recipient_id NOT LIKE 'mock_rcp_%'
   AND recebedor_id IS NULL;

COMMENT ON COLUMN psicologos.recebedor_api_key IS 'asaas: apiKey da subconta, AES-256-GCM (crypto.ts). Só vem na criação.';
COMMENT ON COLUMN psicologos.recebedor_situacao IS 'pendente | em_analise | aprovado | recusado (asaas) · status do recipient (pagarme).';

-- psicólogos: assinatura do plano
ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS assinatura_gateway VARCHAR(20),
  ADD COLUMN IF NOT EXISTS assinatura_id      VARCHAR(100);

UPDATE psicologos
   SET assinatura_gateway = 'pagarme', assinatura_id = pagarme_subscription_id
 WHERE pagarme_subscription_id IS NOT NULL AND assinatura_id IS NULL;

CREATE INDEX IF NOT EXISTS psicologos_assinatura
  ON psicologos (assinatura_gateway, assinatura_id) WHERE assinatura_id IS NOT NULL;

-- Idempotência de webhooks (RF-PG-50). evento_id = string inteira do id do
-- gateway (Asaas: `evt_<hex>&<n>` — o hex se repete por tipo de evento).
CREATE TABLE IF NOT EXISTS webhook_eventos (
  gateway       VARCHAR(20)  NOT NULL,
  evento_id     VARCHAR(120) NOT NULL,
  tipo          VARCHAR(80)  NOT NULL,
  recebido_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  processado_em TIMESTAMPTZ,
  erro          TEXT,
  payload       JSONB,
  PRIMARY KEY (gateway, evento_id)
);
CREATE INDEX IF NOT EXISTS webhook_eventos_pendentes
  ON webhook_eventos (recebido_em) WHERE processado_em IS NULL;
