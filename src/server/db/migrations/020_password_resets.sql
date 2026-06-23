-- ──────────────────────────────────────────────────────────────────────────
-- Recuperação de senha — tokens de reset.
--
-- Fluxo: psicóloga pede reset → geramos um token aleatório, mandamos o token
-- CRU por email (link) e guardamos só o SHA-256 dele aqui. Ao redefinir,
-- comparamos o hash. Token expira em 1h e é de uso único (usado_em).
--
-- Nunca guardamos o token em claro: se o banco vazar, não dá pra resetar senha
-- de ninguém. ON DELETE CASCADE: some junto com a psicóloga.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_resets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id  UUID NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
  token_hash    VARCHAR(64) NOT NULL,        -- sha256 hex do token cru
  expira_em     TIMESTAMPTZ NOT NULL,
  usado_em      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_psicologo ON password_resets(psicologo_id);
