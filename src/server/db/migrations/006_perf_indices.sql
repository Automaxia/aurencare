-- Índices de performance identificados em auditoria de hotspots.
-- Todos NÃO CONCURRENTLY pra rodar via migration runner (sem transação issue).

-- Range por data — usado em dashboard, financeiro, saúde, agenda.
-- O índice existente cobre (psicologo_id, status); este cobre (psicologo_id, data_hora)
-- que é o predicate dominante das queries listarSessoesEntre.
CREATE INDEX IF NOT EXISTS sessoes_psicologo_data
  ON sessoes(psicologo_id, data_hora);

-- Webhooks Pagar.me — order.paid / order.canceled buscam por pagarme_order_id.
-- Parcial pra não inchar com sessões sem pagamento ainda registrado.
CREATE INDEX IF NOT EXISTS sessoes_pagarme_order
  ON sessoes(pagarme_order_id)
  WHERE pagarme_order_id IS NOT NULL;

-- Contexto/temas/evolução só olham sessões assinadas — índice parcial é mais
-- enxuto que o sessoes_paciente_data completo.
CREATE INDEX IF NOT EXISTS sessoes_paciente_assinada
  ON sessoes(paciente_id, data_hora DESC)
  WHERE assinada = TRUE;

-- Limpeza/expiração de salas de vídeo.
CREATE INDEX IF NOT EXISTS salas_video_ativa_ate
  ON salas_video(ativa_ate);
