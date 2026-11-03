-- ──────────────────────────────────────────────────────────────────────────
-- Lembretes opcionais (24h, 2h, 15 min antes da sessão).
--
-- O psicólogo define o PADRÃO (psicologos.lembrete_*) e pode ajustar POR
-- PACIENTE (pacientes.lembrete_*), combinando com ele. No paciente, NULL =
-- "segue o padrão do psicólogo". Valor efetivo no cron:
--   COALESCE(p.lembrete_X, ps.lembrete_X)
--
-- Default TRUE no psicólogo = comportamento de antes (todos ligados).
--
-- Lembrete de 15 min desligado NÃO corta o link da sala: em sessão online o
-- cron manda só o link (template audere_link_sala), sem o texto de lembrete.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS lembrete_24h   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS lembrete_2h    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS lembrete_15min BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS lembrete_24h   BOOLEAN,
  ADD COLUMN IF NOT EXISTS lembrete_2h    BOOLEAN,
  ADD COLUMN IF NOT EXISTS lembrete_15min BOOLEAN;

COMMENT ON COLUMN pacientes.lembrete_24h IS
  'NULL = segue o padrão do psicólogo (psicologos.lembrete_24h).';
COMMENT ON COLUMN pacientes.lembrete_2h IS
  'NULL = segue o padrão do psicólogo (psicologos.lembrete_2h).';
COMMENT ON COLUMN pacientes.lembrete_15min IS
  'NULL = segue o padrão do psicólogo. Desligado não corta o link da sala online.';
