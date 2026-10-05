-- Qualidade das chamadas de vídeo, medida no navegador (RTCPeerConnection.getStats).
-- Uma linha por participante por carregamento da sala (conexao_id gerado no cliente);
-- o cliente reenvia o resumo a cada minuto e ao sair, e a linha é sobrescrita.
-- Serve pra responder: quantas chamadas passam pelo relay (TURN), com que latência,
-- perda e congelamentos — e se o codec está rodando em hardware no celular.
CREATE TABLE IF NOT EXISTS chamadas_qualidade (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id        UUID NOT NULL REFERENCES salas_video(id) ON DELETE CASCADE,
  role           VARCHAR(12) NOT NULL,          -- psicologo | paciente
  conexao_id     VARCHAR(40) NOT NULL,
  mobile         BOOLEAN,
  navegador      VARCHAR(60),
  resumo         JSONB NOT NULL,
  criado_em      TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sala_id, role, conexao_id)
);

CREATE INDEX IF NOT EXISTS chamadas_qualidade_criado ON chamadas_qualidade(criado_em);
