-- Histórico de mensagens do WhatsApp (inbox da psicóloga). Antes só guardávamos
-- o ESTADO da conversa (wa_conversas); agora persistimos cada mensagem.
CREATE TABLE IF NOT EXISTS wa_mensagens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone      VARCHAR(20) NOT NULL,
  psicologo_id  UUID REFERENCES psicologos(id) ON DELETE CASCADE,
  paciente_id   UUID REFERENCES pacientes(id)  ON DELETE SET NULL,
  direcao       VARCHAR(3) NOT NULL,            -- 'in' (paciente) | 'out' (app/psicóloga)
  texto         TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wa_mensagens_psi ON wa_mensagens(psicologo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_mensagens_tel ON wa_mensagens(telefone, created_at);

-- Marca quando a psicóloga leu a conversa pela última vez (pra contar não lidas).
ALTER TABLE wa_conversas
  ADD COLUMN IF NOT EXISTS psi_lida_em TIMESTAMPTZ;
