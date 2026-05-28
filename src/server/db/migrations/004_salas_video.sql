-- Salas de vídeo p/ atendimento online via Auren
CREATE TABLE IF NOT EXISTS salas_video (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id     UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  token         VARCHAR(32) NOT NULL UNIQUE,
  criada_em     TIMESTAMPTZ DEFAULT NOW(),
  ativa_ate     TIMESTAMPTZ NOT NULL,
  encerrada_em  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS salas_video_sessao ON salas_video(sessao_id);
CREATE INDEX IF NOT EXISTS salas_video_token  ON salas_video(token);
