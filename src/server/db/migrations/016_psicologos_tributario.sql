-- ──────────────────────────────────────────────────────────────────────────
-- Perfil tributário do(a) psicólogo(a) — pré-requisito para:
--  · Cálculos corretos de imposto estimado (DAS / Carnê-Leão)
--  · Exportação CSV pro contador no formato esperado
--  · ISS retido (varia por município)
--  · CNAE padrão para psicologia: 8650-0/03 (Atividades de psicologia e
--    psicanálise — Anexo III ou V do Simples Nacional, com Fator R)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  -- 'autonomo_pf' | 'pj_simples_anexo3' | 'pj_simples_anexo5' | 'pj_lucro_presumido'
  ADD COLUMN IF NOT EXISTS regime_tributario     VARCHAR(40),
  ADD COLUMN IF NOT EXISTS cnae                  VARCHAR(20) DEFAULT '8650-0/03',
  ADD COLUMN IF NOT EXISTS municipio             VARCHAR(80),
  ADD COLUMN IF NOT EXISTS municipio_uf          VARCHAR(2),
  -- Alíquota de ISS do município (varia 2%-5% no Brasil; default 2 quando NULL).
  ADD COLUMN IF NOT EXISTS iss_aliquota_pct      NUMERIC(5,2),
  -- TRUE se o paciente costuma reter ISS na fonte (raro em PF, comum em PJ B2B).
  ADD COLUMN IF NOT EXISTS iss_retido_default    BOOLEAN DEFAULT FALSE,
  -- Contato do contador — usado nas exportações e (no futuro) envio automático.
  ADD COLUMN IF NOT EXISTS nome_contador         VARCHAR(160),
  ADD COLUMN IF NOT EXISTS email_contador        VARCHAR(255);
