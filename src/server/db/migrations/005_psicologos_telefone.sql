-- Adiciona telefone do psicólogo (mesmo número usado para WhatsApp)
ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);

-- Opcional: aceite explícito dos termos de uso na criação
ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS psicologos_telefone ON psicologos(telefone);
