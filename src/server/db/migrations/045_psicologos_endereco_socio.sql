-- ──────────────────────────────────────────────────────────────────────────
-- Onboarding de recebimento: endereço (PF e PJ) e sócio administrador (PJ).
--
-- A Pagar.me RECUSA a criação do recebedor sem esses dados:
--   individual  → register_information.address           (obrigatório)
--   corporation → register_information.main_address      (obrigatório)
--                 register_information.managing_partners (≥ 1 item)
-- Sem eles o onboarding falhava para TODOS os psicólogos — por isso não havia
-- nenhum recipient criado.
--
-- O endereço do sócio reaproveita o da empresa (a Pagar.me exige um endereço
-- por sócio, mas o formulário não pede dois). Se um dia precisar divergir,
-- acrescenta-se um bloco pgm_socio_end_*.
--
-- CPF do sócio é dado sensível → cifrado em repouso, como pgm_documento.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  -- Endereço do recebedor (residencial na PF, sede na PJ)
  ADD COLUMN IF NOT EXISTS pgm_end_cep          VARCHAR(8),
  ADD COLUMN IF NOT EXISTS pgm_end_logradouro   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pgm_end_numero       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pgm_end_complemento  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS pgm_end_bairro       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS pgm_end_cidade       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS pgm_end_uf           VARCHAR(2),
  -- Sócio administrador — só PJ
  ADD COLUMN IF NOT EXISTS pgm_socio_nome           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pgm_socio_cpf            TEXT,      -- AES-256-GCM
  ADD COLUMN IF NOT EXISTS pgm_socio_nascimento     DATE,
  ADD COLUMN IF NOT EXISTS pgm_socio_email          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pgm_socio_telefone       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pgm_socio_renda_centavos INTEGER;

COMMENT ON COLUMN psicologos.pgm_socio_cpf IS
  'CPF do sócio administrador, cifrado (AES-256-GCM). Exigido pela Pagar.me em managing_partners.';
