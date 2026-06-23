-- Corrige a 022_usuarios_gestao: o código de gestão (authorize + bloqueio de
-- acesso) consulta `psicologos.status`, mas a 022 assumiu erroneamente que a
-- coluna já existia ("status (já existe: 'ativo' default)") e não a criou.
-- Sem ela, o SELECT do authorize quebra com `column "status" does not exist`
-- e o login falha em todo deploy.
--
-- Default 'ativo' → psicólogos legados NÃO são bloqueados. 'suspenso' = bloqueado.
ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ativo';
