-- Lembrete "15 minutos antes" da sessão (WhatsApp + email, com link da sala).
-- Flag idempotente: o cron só envia uma vez por sessão.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS wa_lembrete_15min BOOLEAN DEFAULT FALSE;
