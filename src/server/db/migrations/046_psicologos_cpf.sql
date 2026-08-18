-- ──────────────────────────────────────────────────────────────────────────
-- CPF do psicólogo como dado cadastral.
--
-- Já existia `pgm_documento`, mas ele NÃO serve para identificar a pessoa:
--   • só é preenchido por quem passa pelo onboarding de recebimento;
--   • guarda CNPJ quando pgm_tipo_pessoa = 'PJ' — o CPF da pessoa se perde.
-- Ou seja: hoje um psicólogo PJ, ou qualquer um que não configurou conta de
-- recebimento, não tem CPF em lugar nenhum. Esta coluna é a identificação
-- fiscal da pessoa física, sempre — independente de como ela recebe.
--
-- `pgm_documento` continua existindo e mantém o papel dele: o documento do
-- RECEBEDOR enviado à Pagar.me (CPF na PF, CNPJ na PJ). Os dois coincidem
-- no caso PF, e isso é esperado — são fatos diferentes sobre o mesmo cadastro.
--
-- Cifrado em repouso (AES-256-GCM, src/server/lib/crypto.ts), como
-- pgm_documento e pgm_socio_cpf → daí TEXT, não VARCHAR(11): o que fica
-- gravado é `v1:<iv>:<ct>:<tag>`, não os 11 dígitos.
--
-- NULL por ora: os psicólogos já cadastrados não têm o dado. O backfill do
-- caso PF (copiar de pgm_documento) exige decifrar/recifrar e por isso vive
-- em scripts/backfill-cpf-psicologo.ts, não aqui. Tornar NOT NULL é passo
-- separado, depois que o backfill rodar e o cadastro passar a exigir.
--
-- Sem UNIQUE: o ciphertext usa IV aleatório, então o mesmo CPF grava bytes
-- diferentes a cada escrita e um índice único não pegaria duplicata. Para
-- barrar CPF repetido seria preciso um blind index (HMAC determinístico) —
-- fora do escopo desta migration.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE psicologos
  ADD COLUMN IF NOT EXISTS cpf TEXT;

COMMENT ON COLUMN psicologos.cpf IS
  'CPF do psicólogo (pessoa física), cifrado AES-256-GCM. Identificação fiscal/cadastral, sempre — distinto de pgm_documento, que é o documento do recebedor Pagar.me (CPF|CNPJ).';
