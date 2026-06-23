-- Grafo de temas: tipo semântico da relação entre dois termos
-- (causes | co-occurs | identity | avoidance | amplifies | contrasts | temporal),
-- extraído pela IA (MODE: GRAPH). Antes a aresta era só co-ocorrência sem tipo.
ALTER TABLE arestas_tema
  ADD COLUMN IF NOT EXISTS tipo TEXT;
