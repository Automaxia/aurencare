-- ──────────────────────────────────────────────────────────────────────────
-- Histórico de prontuários redigidos com apoio da IA assistente (CFP 09/2024).
-- Conteúdo e mensagens criptografados em repouso (AES-256-GCM, §14).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prontuarios_ia (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id   UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  psicologo_id  UUID NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
  titulo        VARCHAR(160) NOT NULL,
  -- Texto final da última versão aprovada (criptografado).
  texto_enc     TEXT NOT NULL,
  -- Histórico de mensagens do chat ({role, content}[]), criptografado como JSON.
  -- Permite retomar a conversa exatamente onde parou.
  mensagens_enc TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prontuarios_ia_paciente
  ON prontuarios_ia(paciente_id, updated_at DESC);
