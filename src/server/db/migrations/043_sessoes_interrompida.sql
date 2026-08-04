-- Sessão interrompida: iniciada mas encerrada sem virar registro clínico
-- (psicóloga precisou parar no meio, ou a aba caiu e o cron destravou).
--
-- Não é um status novo de propósito: a sessão VOLTA pra fila (confirmada /
-- aguardando_pagamento / agendada) pra poder ser remarcada, e o pagamento
-- continua intacto. Estas colunas guardam só a trilha de auditoria de que a
-- interrupção aconteceu — o conteúdo parcial é descartado, nunca gravado.
--
-- interrompida_origem: 'psicologo' (botão "Encerrar sem registrar")
--                    | 'cron'      (varredura de sessão travada em em_curso)
-- Aditivas, nullable.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS interrompida_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interrompida_origem VARCHAR(20);

-- Quando a sessão entrou em curso. É a âncora da varredura de zumbis: medir
-- "travada há X horas" por data_hora erra quando a sessão começa muito antes ou
-- depois do horário agendado. Nas linhas antigas fica NULL e o COALESCE da
-- varredura cai de volta em data_hora.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS iniciada_em TIMESTAMPTZ;

-- A varredura busca por status + tempo; índice parcial mantém o scan barato
-- mesmo com a tabela grande (só as poucas linhas em_curso entram no índice).
CREATE INDEX IF NOT EXISTS idx_sessoes_em_curso
  ON sessoes (iniciada_em, data_hora)
  WHERE status = 'em_curso';
