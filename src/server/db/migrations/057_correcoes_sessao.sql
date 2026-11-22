-- ──────────────────────────────────────────────────────────────────────────
-- Correção de sessão com registro clínico (feedback de psicóloga, nov/2026).
--
-- Erros acontecem: sessão registrada no paciente errado, ou sessão que não
-- devia existir. Duas ações novas, ambas sob termo de responsabilidade aceito
-- pelo psicólogo (dupla confirmação) e registradas em log:
--
--  1. TRANSFERIR REGISTRO — move só o conteúdo clínico (transcrição, resumos,
--     laudo, nota, indicadores, assinatura) pra uma sessão de outro paciente.
--     Agenda e pagamento ficam onde estão.
--  2. EXCLUIR (ARQUIVAR) — a sessão sai do sistema, mas a linha inteira é
--     copiada pra `sessoes_arquivadas` (campos clínicos seguem cifrados). O CFP
--     exige guarda do prontuário por 5 anos; o arquivo cobre isso.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessoes_correcoes_log (
  id                   BIGSERIAL PRIMARY KEY,
  psicologo_id         UUID NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
  acao                 VARCHAR(30) NOT NULL,   -- transferir_registro | excluir
  sessao_id            UUID NOT NULL,          -- sem FK: a sessão pode ter sido arquivada
  sessao_destino_id    UUID,                   -- transferir: sessão que recebeu o registro
  paciente_origem_id   UUID,
  paciente_destino_id  UUID,
  motivo               TEXT NOT NULL,
  termo_versao         VARCHAR(20) NOT NULL,
  termo_texto          TEXT NOT NULL,          -- texto exato aceito, congelado
  confirmacao_digitada VARCHAR(255) NOT NULL,  -- o que o psicólogo digitou pra confirmar
  ip                   VARCHAR(64),
  user_agent           TEXT,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessoes_correcoes_log_psicologo ON sessoes_correcoes_log(psicologo_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS sessoes_correcoes_log_sessao    ON sessoes_correcoes_log(sessao_id);

CREATE TABLE IF NOT EXISTS sessoes_arquivadas (
  id            UUID PRIMARY KEY,              -- mesmo id da sessão original
  psicologo_id  UUID NOT NULL,
  paciente_id   UUID NOT NULL,
  dados         JSONB NOT NULL,                -- to_jsonb(linha de sessoes), campos clínicos cifrados
  correcao_id   BIGINT REFERENCES sessoes_correcoes_log(id),
  arquivada_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessoes_arquivadas_paciente ON sessoes_arquivadas(paciente_id);
