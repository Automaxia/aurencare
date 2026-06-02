-- ──────────────────────────────────────────────────────────────────────────
-- Aceite do Termo de Consentimento Informado pra Atendimento Online —
-- exigido por Resolução CFP 11/2018 (atendimento online) + 06/2019
-- (prontuário) + 09/2024 (IA) + LGPD (dado sensível de saúde).
--
-- Registramos por sala (sessão) pra ter evidência por atendimento.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE salas_video
  ADD COLUMN IF NOT EXISTS aceite_termo_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aceite_termo_ip      VARCHAR(45),
  ADD COLUMN IF NOT EXISTS aceite_termo_ua      TEXT,
  -- Versão do termo aceito — quando o texto mudar (revisões CFP),
  -- pacientes precisam reaceitar.
  ADD COLUMN IF NOT EXISTS aceite_termo_versao  VARCHAR(20);
