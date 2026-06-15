-- Retificação do laudo: permite editar o resumo MESMO depois de assinado,
-- preservando as versões anteriores (prontuário não apaga — retifica).
--   resumo_historico: array JSONB de { texto (cifrado), em (ISO) } das versões
--                     substituídas, da mais antiga pra mais recente.
--   resumo_editado_em: quando o resumo assinado foi retificado pela última vez.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS resumo_historico JSONB,
  ADD COLUMN IF NOT EXISTS resumo_editado_em TIMESTAMPTZ;
