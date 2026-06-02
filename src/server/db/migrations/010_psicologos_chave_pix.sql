-- ──────────────────────────────────────────────────────────────────────────
-- Chave PIX preferida da psicóloga — coleta opcional no wizard.
-- Uso atual: registro/preferência (Pagar.me ainda repassa via TED).
-- Uso futuro: propagar pra Pagar.me quando suportarem repasse direto via PIX,
-- e usar como destino padrão em estornos de pacientes.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  -- 'cpf' | 'cnpj' | 'email' | 'celular' | 'aleatoria'
  ADD COLUMN IF NOT EXISTS pgm_chave_pix_tipo  VARCHAR(20),
  -- Valor da chave criptografado em repouso (AES-256-GCM, §14)
  ADD COLUMN IF NOT EXISTS pgm_chave_pix_valor TEXT;
