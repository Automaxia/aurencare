-- ──────────────────────────────────────────────────────────────────────────
-- Troca de plano agendada para a renovação (nov/2026, Asaas).
--
-- Regra: SUBIR de plano vale na hora (a diferença proporcional entra na
-- próxima fatura); DESCER de plano ou trocar o ciclo vale só na renovação —
-- sem isso dava para subir pro Pro, gastar as 80 sessões e descer antes de
-- pagar. Até a renovação, `plano`/`plano_ciclo` seguem os atuais e o destino
-- fica aqui.
--
-- `plano_agendado_vigencia` = vencimento da cobrança que já sai no valor novo.
-- O webhook só aplica a troca quando a cobrança paga vence nessa data ou
-- depois: o PAYMENT_RECEIVED do cartão chega ~30 dias após o CONFIRMED, e o
-- de um ciclo antigo não pode antecipar a troca.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS plano_agendado          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS plano_ciclo_agendado    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS plano_agendado_vigencia DATE;
