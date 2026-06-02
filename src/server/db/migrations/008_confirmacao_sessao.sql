-- ──────────────────────────────────────────────────────────────────────────
-- Fluxo de confirmação pós-sessão pelo paciente (proteção Auren §10).
-- Janela: 2h diurnas (8h–20h), até 9h do dia seguinte se sessão noturna.
-- Silêncio = consentimento. NAO/CONTESTAR = pagamento congelado p/ disputa.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE sessoes
  -- Token único usado no link público /confirmar/[token]
  ADD COLUMN IF NOT EXISTS confirmacao_token             VARCHAR(64),
  -- Quando a mensagem WhatsApp foi disparada
  ADD COLUMN IF NOT EXISTS confirmacao_enviada_em        TIMESTAMPTZ,
  -- 'sim' | 'contestou' | 'silencio' | NULL (ainda na janela)
  ADD COLUMN IF NOT EXISTS confirmacao_resposta          VARCHAR(20),
  -- Momento da resposta (ou da liberação automática se 'silencio')
  ADD COLUMN IF NOT EXISTS confirmacao_resposta_em       TIMESTAMPTZ,
  -- Janela computada: até quando esperar antes de auto-liberar
  ADD COLUMN IF NOT EXISTS confirmacao_janela_expira_em  TIMESTAMPTZ,
  -- Evidência jurídica (IP + user agent + canal: 'whatsapp' ou 'web')
  ADD COLUMN IF NOT EXISTS confirmacao_evidencia         JSONB;

-- Token deve ser único (índice parcial — só onde existe)
CREATE UNIQUE INDEX IF NOT EXISTS sessoes_confirmacao_token
  ON sessoes(confirmacao_token)
  WHERE confirmacao_token IS NOT NULL;

-- Cron de liberação por silêncio busca janelas expiradas sem resposta.
CREATE INDEX IF NOT EXISTS sessoes_confirmacao_pendente
  ON sessoes(confirmacao_janela_expira_em)
  WHERE confirmacao_resposta IS NULL
    AND confirmacao_janela_expira_em IS NOT NULL;

COMMENT ON COLUMN sessoes.confirmacao_resposta IS
  'sim = paciente confirmou; contestou = paciente negou; silencio = janela expirou sem resposta.';
