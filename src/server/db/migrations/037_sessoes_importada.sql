-- Sessões importadas de transcrições externas (backfill de histórico do psicólogo).
-- Nascem concluídas + com rascunho de laudo; o psicólogo revisa e assina como
-- qualquer sessão. Flag pra pular efeitos voltados ao paciente (WhatsApp pós-sessão)
-- — é histórico, não uma sessão que acabou de acontecer.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS importada BOOLEAN NOT NULL DEFAULT FALSE;
