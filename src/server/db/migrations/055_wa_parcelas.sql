-- ──────────────────────────────────────────────────────────────────────────
-- WhatsApp: pergunta de parcelas no CRÉDITO (Asaas, D-03 / RF-PG-22).
--
-- No Asaas o parcelamento é escolhido ANTES de criar a cobrança (o link de
-- pagamento parcelado descarta o split). Então CREDITO não gera o link na hora:
-- o WhatsApp pergunta "em quantas vezes, de 1 a 6?" e marca aqui quando
-- perguntou. A resposta numérica do paciente só vale para a sessão com essa
-- marca (e recente) — um "2" solto em outra conversa não vira cobrança.
-- Limpa quando a cobrança é gerada (PIX ou cartão).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS wa_parcelas_perguntado_em TIMESTAMPTZ;
