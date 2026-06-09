-- ──────────────────────────────────────────────────────────────────────────
-- Dados cadastrais/demográficos do paciente (#2) — todos opcionais.
--
-- Guardados num único JSONB pra flexibilidade (e pra comportar a lista de
-- contatos de emergência, que pode ter mais de um). Shape esperado:
--   {
--     nomeSocial, cpf, pais, estado, cidade, racaCor, genero,
--     estadoCivil, ocupacao, formacao, origem,
--     contatosEmergencia: [{ nome, telefone, email }]
--   }
--
-- Nota LGPD: CPF é dado sensível. Guardado aqui em claro no JSONB por ora
-- (banco já protegido); cifragem dedicada do CPF fica como hardening futuro.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS dados_cadastro JSONB;
