-- ──────────────────────────────────────────────────────────────────────────
-- Controle de usuários / gestão — fundação (foco: psicólogos solo isolados;
-- preparado pra clínica/equipe no futuro, sem implementá-la agora).
--
-- - role: papel do usuário. 'psicologo' (default) | 'admin' (gestão da plataforma).
-- - organizacao_id: COSTURA org-ready. Hoje fica NULL (= conta solo). Quando
--   existir clínica, agrupa vários usuários sob uma organização. Não é usado
--   por nenhuma query ainda — é só o "gancho" pra não reescrever o schema depois.
-- - status (já existe: 'ativo' default) passa a também aceitar 'suspenso' por
--   convenção, usado pela gestão pra bloquear acesso. O bloqueio de login é no app.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS role            VARCHAR(20) NOT NULL DEFAULT 'psicologo',
  ADD COLUMN IF NOT EXISTS organizacao_id  UUID;

-- Bootstrap: o psicólogo mais antigo vira admin, se ainda não houver nenhum admin.
-- (No solo atual, é o fundador. Depois a gestão promove/rebaixa via painel.)
UPDATE psicologos SET role = 'admin'
 WHERE id = (SELECT id FROM psicologos ORDER BY created_at ASC LIMIT 1)
   AND NOT EXISTS (SELECT 1 FROM psicologos WHERE role = 'admin');

CREATE INDEX IF NOT EXISTS idx_psicologos_organizacao ON psicologos(organizacao_id) WHERE organizacao_id IS NOT NULL;
