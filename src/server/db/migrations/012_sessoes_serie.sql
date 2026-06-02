-- ──────────────────────────────────────────────────────────────────────────
-- Série de sessões recorrentes (ex: toda sexta às 15h, 4 sessões).
-- Sessões da mesma série compartilham serie_id — usado pra cancelar/editar
-- em lote no futuro.
--
-- wa_pergunta_metodo_em: timestamp de quando o Fluxo 2 foi disparado pro
-- paciente. Avulsa preenche no INSERT; série fica NULL até cron disparar
-- 48h antes de cada sessão.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS serie_id                 UUID,
  ADD COLUMN IF NOT EXISTS wa_pergunta_metodo_em    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS sessoes_serie ON sessoes(serie_id) WHERE serie_id IS NOT NULL;

-- Cron de "perguntar método 48h antes" filtra por wa_pergunta_metodo_em IS NULL.
CREATE INDEX IF NOT EXISTS sessoes_aguardando_metodo_sem_pergunta
  ON sessoes(data_hora)
  WHERE status = 'aguardando_metodo' AND wa_pergunta_metodo_em IS NULL;
