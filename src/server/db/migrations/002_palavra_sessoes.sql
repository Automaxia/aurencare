-- Rastreia em quais sessões cada palavra-chave apareceu (para filtro do grafo)
ALTER TABLE palavras_chave
  ADD COLUMN IF NOT EXISTS sessoes_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS palavras_sessoes_ids
  ON palavras_chave USING GIN (sessoes_ids);
