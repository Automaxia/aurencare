-- Resumo curto automático da sessão (modelo fast, barato), separado do laudo
-- formal CFP (resumo_ia, modelo forte, gerado sob demanda). Criptografado como os
-- demais textos clínicos. Aditiva, nullable.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS resumo_curto TEXT;
