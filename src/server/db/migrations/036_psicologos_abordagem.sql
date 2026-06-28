-- ──────────────────────────────────────────────────────────────────────────
-- §6 — Lente de rubrica por abordagem. A extração Clínica reordena o peso dos
-- critérios conforme a abordagem do psicólogo (TCC primeiro). Não troca a
-- rubrica base — só promove os critérios da abordagem.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS abordagem VARCHAR(20) DEFAULT 'tcc';
