-- ──────────────────────────────────────────────────────────────────────────
-- E-mail com que a subconta do Asaas foi aberta.
--
-- O Asaas recusa uma 2ª subconta com o mesmo e-mail. Quem refaz o cadastro de
-- recebimento (PF → PJ, ou o 1º foi recusado) recebe um alias do e-mail de
-- login (`nome+audere2@dominio`) — o acesso do Asaas chega nele, e o Perfil
-- precisa dizer qual foi. NULL = o próprio e-mail de login.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS recebedor_email VARCHAR(255);
