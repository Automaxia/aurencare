-- Gênero/forma de tratamento do profissional, pra usar o título correto
-- (psicólogo/psicóloga) em textos e evitar concordância errada. Opcional.
ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS genero VARCHAR(1);  -- 'f' | 'm' | NULL (não informado)
