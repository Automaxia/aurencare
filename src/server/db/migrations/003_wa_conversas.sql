-- Conversas WhatsApp — estado por telefone, persistente, com contexto JSON
CREATE TABLE IF NOT EXISTS wa_conversas (
  telefone        VARCHAR(20)  PRIMARY KEY,             -- E164 sem '+' (ex: 5511999...)
  estado          VARCHAR(40)  NOT NULL DEFAULT 'inicio',
  psicologo_id    UUID         REFERENCES psicologos(id) ON DELETE SET NULL,
  paciente_id     UUID         REFERENCES pacientes(id)  ON DELETE SET NULL,
  contexto        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ultima_msg_em   TIMESTAMPTZ  DEFAULT NOW(),
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wa_conversas_paciente ON wa_conversas(paciente_id);
CREATE INDEX IF NOT EXISTS wa_conversas_psicologo ON wa_conversas(psicologo_id);
